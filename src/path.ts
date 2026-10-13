import { smooth } from "./director";
import { movementAt, sequenceStop, type Sequence } from "./sequences";
import type { Plan } from "./model";
import { duration } from "./domain/plan-time";
import { detourProfile, lateralAt } from "./domain/traversal";
export interface Point {
  x: number;
  z: number;
}
export interface Segment {
  a: Point;
  b: Point;
  start: number;
  end: number;
  dx: number;
  dz: number;
  length: number;
  distanceStart: number;
  speed: number;
  motion: Motion[];
  travel?: { step: number; values: number[] };
  sequences?: Sequence[];
}
interface Motion {
  start: number;
  end: number;
  pace: number;
  previous: number;
  fade: number;
}
function profile(p: Plan): Motion[] {
  return p.chapters.map((c, i) => ({
    start: c.start,
    end: p.chapters[i + 1]?.start ?? duration(p),
    pace: c.pace ?? 1,
    previous: p.chapters[Math.max(0, i - 1)].pace ?? 1,
    fade: Math.min(
      p.transition.seconds,
      (p.chapters[i + 1]?.start ?? duration(p)) - c.start,
    ),
  }));
}
// Exact integral of smoothstep velocity; seeking never needs earlier frames.
function distance(motion: Motion[], speed: number, t: number) {
  let total = 0;
  for (const m of motion) {
    const x = Math.max(0, Math.min(m.end - m.start, t - m.start)),
      u = Math.min(1, x / m.fade);
    total +=
      speed *
      (m.previous * Math.min(x, m.fade) +
        (m.pace - m.previous) * m.fade * (u * u * u - 0.5 * u * u * u * u) +
        Math.max(0, x - m.fade) * m.pace);
  }
  return total;
}
export function speedAt(p: Plan, t: number) {
  return profileSpeed(p, profile(p), t);
}
function profileSpeed(p: Plan, motion: Motion[], t: number) {
  const m = motion.filter((m) => m.start <= t).at(-1)!;
  const u = Math.max(0, Math.min(1, (t - m.start) / m.fade));
  return (
    movementAt(p, t) *
    p.path.speed *
    (m.previous + (m.pace - m.previous) * u * u * (3 - 2 * u))
  );
}
export function makePath(p: Plan): Segment[] {
  const motion = profile(p);
  const sequences = p.features?.sequences === false ? [] : (p.sequences ?? []);
  const times = [
    0,
    ...p.path.turnTimes.filter(
      (t) => !sequences.some((s) => t > s.start - 3 && t < s.end + 3),
    ),
    duration(p),
  ];
  const travel = sequences.length ? { step: 0.05, values: [0] } : undefined;
  if (travel)
    for (let i = 1; i <= Math.ceil(duration(p) / travel.step); i++)
      travel.values.push(
        travel.values[i - 1] +
          (profileSpeed(p, motion, (i - 1) * travel.step) +
            profileSpeed(p, motion, i * travel.step)) *
            travel.step *
            0.5,
      );
  const result: Segment[] = [];
  let a = { x: 0, z: 0 };
  for (let i = 0; i < times.length - 1; i++) {
    const start = times[i],
      end = times[i + 1],
      distanceStart = travel
        ? sampleTravel(travel, start)
        : distance(motion, p.path.speed, start),
      length =
        (travel
          ? sampleTravel(travel, end)
          : distance(motion, p.path.speed, end)) - distanceStart;
    // Every other segment advances in -Z, so horizontal turns cannot cross earlier roads.
    const dx = i % 2 === 0 ? 0 : i % 4 === 1 ? 1 : -1,
      dz = i % 2 === 0 ? -1 : 0;
    const b = { x: a.x + dx * length, z: a.z + dz * length };
    result.push({
      a,
      b,
      start,
      end,
      dx,
      dz,
      length,
      distanceStart,
      speed: p.path.speed,
      motion,
      travel,
      sequences,
    });
    a = b;
  }
  for (const sequence of sequences) {
    const traversal = sequence.composition?.traversal;
    if (traversal && !passageProfile(result, sequence).feasible)
      throw Error(
        `「${sequence.composition!.title}」行走距离不足以进入并离开空间，请延长桥段或选择路边观察`,
      );
  }
  return result;
}
export function basePositionAt(path: Segment[], time: number) {
  const s = path.find((s) => time < s.end) ?? path.at(-1)!;
  const f = Math.max(
    0,
    Math.min(
      1,
      (travelledAt(path, time) - s.distanceStart) /
        Math.max(0.000001, s.length),
    ),
  );
  return {
    x: s.a.x + (s.b.x - s.a.x) * f,
    z: s.a.z + (s.b.z - s.a.z) * f,
    heading: Math.atan2(s.dx, s.dz),
    segment: s,
  };
}

function sampleTravel(
  travel: { step: number; values: number[] },
  time: number,
) {
  const n = Math.max(0, Math.min(travel.values.length - 1, time / travel.step)),
    i = Math.floor(n);
  return (
    travel.values[i] +
    ((travel.values[i + 1] ?? travel.values[i]) - travel.values[i]) * (n - i)
  );
}
export function travelledAt(path: Segment[], time: number) {
  const s = path[0];
  return s.travel
    ? sampleTravel(s.travel, time)
    : distance(s.motion, s.speed, time);
}

export function positionAt(path: Segment[], time: number) {
  const pos = basePositionAt(path, time);
  const tavern = path[0].sequences?.find(
    (s) => hasDetour(s) && time >= s.start && time <= s.end,
  );
  if (!tavern) return pos;
  const delta =
    travelledAt(path, time) -
    travelledAt(path, (tavern.start + tavern.end) / 2);
  const offset = (d: number) => routeOffset(path, tavern, d);
  const side = offset(delta),
    derivative = (offset(delta + 0.01) - offset(delta - 0.01)) / 0.02;
  return {
    ...pos,
    x: pos.x + pos.segment.dz * side,
    z: pos.z - pos.segment.dx * side,
    heading: Math.atan2(
      pos.segment.dx + pos.segment.dz * derivative,
      pos.segment.dz - pos.segment.dx * derivative,
    ),
  };
}
export function tavernOffset(
  path: Segment[],
  sequence: Sequence,
  delta: number,
) {
  const { outer, inner } = tavernProfile(path, sequence);
  if (outer < 12) return 0;
  return 12 * (1 - smooth((Math.abs(delta) - inner) / (outer - inner)));
}
/** Shared breakpoints for motion and its conservative spatial reservation. */
export function tavernProfile(path: Segment[], sequence: Sequence) {
  const center = travelledAt(path, sequenceStop(sequence));
  const reach = Math.min(
    center - travelledAt(path, sequence.start),
    travelledAt(path, sequence.end) - center,
  );
  const outer = Math.min(24, reach * 0.95),
    inner = Math.min(10, outer * 0.5);
  return { center, outer, inner };
}

export const hasDetour = (sequence: Sequence) =>
  sequence.kind === "tavern" || !!sequence.composition?.traversal;
export function passageProfile(path: Segment[], sequence: Sequence) {
  const center = travelledAt(path, sequenceStop(sequence));
  return detourProfile(
    center,
    travelledAt(path, sequence.start),
    travelledAt(path, sequence.end),
    sequence.composition!.traversal!.passage.halfLength,
  );
}
export function routeProfile(path: Segment[], sequence: Sequence) {
  return sequence.composition?.traversal
    ? passageProfile(path, sequence)
    : tavernProfile(path, sequence);
}
export function routeOffset(
  path: Segment[],
  sequence: Sequence,
  delta: number,
) {
  const t = sequence.composition?.traversal;
  if (!t) return tavernOffset(path, sequence, delta);
  const profile = passageProfile(path, sequence);
  return lateralAt(delta, profile.inner, profile.outer, t.lateral);
}
