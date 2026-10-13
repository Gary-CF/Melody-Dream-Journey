import { chapterAt, duration, type Plan } from "./model";
import { positionAt, speedAt, type Segment } from "./path";
import { cameraPose, smooth, type View } from "./director";
import { observerSpace } from "./domain/observer-space";
import type { Vec3 } from "./domain/spatial";
import type { ShotView } from "./domain/shot-intent";
import { transitionCamera } from "./domain/camera-transition";
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mix = (a: Vec3, b: Vec3, t: number): Vec3 =>
  a.map((v, i) => lerp(v, b[i], t)) as Vec3;

/** Legacy chapter camera policy, isolated from World and evaluated at absolute
 * music time. First-person uses the same observer eye contract as manual mode.
 */
export function legacyCamera(
  p: Plan,
  path: Segment[],
  time: number,
  energy: number,
): ReturnType<typeof transitionCamera> {
  const pos = positionAt(path, time),
    ahead = positionAt(path, Math.min(duration(p), time + 4));
  const chapter = chapterAt(p, time),
    idx = p.chapters.indexOf(chapter),
    previous = p.chapters[Math.max(0, idx - 1)];
  const m = chapter.moment,
    phase = m
      ? Math.max(0, Math.min(1, (time - chapter.start) / m.duration))
      : 0;
  const emphasis =
    m && m.kind !== "none" ? Math.sin(phase * Math.PI) ** 2 * m.strength : 0;
  const distance =
    p.visual.distance + emphasis * (m?.kind === "rise" ? 24 : 12);
  let track: ShotView = {
    position: [
      pos.x + distance * 0.65,
      p.visual.height +
        energy * p.transition.cameraExpansion +
        emphasis * (m?.kind === "rise" ? 5 : 4),
      pos.z + distance * 0.9,
    ],
    target: [
      pos.x * 0.68 + ahead.x * 0.32,
      1.1,
      pos.z * 0.68 + ahead.z * 0.32 - 2,
    ],
    fov: 48,
  };
  if (!chapter.director)
    return {
      track,
      eyeAttached: false,
      heroVisible: true,
      transition: { kind: "continuous", fade: 0 },
    };
  const headingAt = (t: number) => {
    // The legacy smoothing knob now controls an absolute-time heading window,
    // so seeking and continuous playback resolve to the same camera pose.
    const span = 0.12 + p.visual.smoothing * 1.5;
    const a = positionAt(path, Math.max(0, t - span * 0.45)),
      b = positionAt(path, Math.min(duration(p), t + span * 0.55)),
      n = Math.hypot(b.x - a.x, b.z - a.z),
      current = positionAt(path, t);
    return n > 0.001
      ? { x: (b.x - a.x) / n, z: (b.z - a.z) / n }
      : { x: Math.sin(current.heading), z: Math.cos(current.heading) };
  };
  const pose = (c: typeof chapter): ShotView => {
    const view: View = c.director?.view ?? "overhead",
      end = p.chapters[p.chapters.indexOf(c) + 1]?.start ?? duration(p);
    const anchor = view === "still" ? positionAt(path, c.start) : pos;
    const raw = cameraPose(
      view,
      anchor,
      headingAt(view === "still" ? c.start : time),
      (time - c.start) / Math.max(1, end - c.start),
      p.visual.observerScale,
    );
    const result: ShotView = {
      position: raw.position as Vec3,
      target: raw.target as Vec3,
      fov: 48,
    };
    if (view === "still") {
      result.target = [pos.x, 1.1, pos.z];
      const follow = cameraPose(
          "follow",
          pos,
          headingAt(time),
          0,
          p.visual.observerScale,
        ),
        release = smooth((time - c.start - 4) / 4);
      result.position = mix(result.position, follow.position as Vec3, release);
      result.target = mix(result.target, follow.target as Vec3, release);
    }
    if (view === "first") {
      const forward = headingAt(time),
        eye = observerSpace(p.visual.observerScale).eyeY;
      return {
        position: [pos.x, eye, pos.z],
        target: [pos.x + forward.x * 18, eye + 0.15, pos.z + forward.z * 18],
        fov: 68,
      };
    }
    if (["follow", "eye", "shoulder", "still"].includes(view)) {
      const back =
        view === "follow" || view === "still" ? 10 : view === "eye" ? 4 : 3;
      const cameraTime = time - back / Math.max(0.3, speedAt(p, time)),
        center = positionAt(
          path,
          Math.max(0, Math.min(duration(p), cameraTime)),
        ),
        heading = headingAt(Math.max(0, cameraTime));
      const side = Math.min(p.visual.roadWidth * 0.18, 0.8),
        weight = view === "still" ? smooth((time - c.start - 4) / 4) : 1;
      const cx =
          center.x +
          heading.z * side +
          (cameraTime < 0 ? heading.x * cameraTime * speedAt(p, 0) : 0),
        cz =
          center.z -
          heading.x * side +
          (cameraTime < 0 ? heading.z * cameraTime * speedAt(p, 0) : 0);
      result.position[0] = lerp(result.position[0], cx, weight);
      result.position[2] = lerp(result.position[2], cz, weight);
      const target = positionAt(path, Math.min(duration(p), time + 1.5));
      result.target[0] = lerp(result.target[0], target.x, weight);
      result.target[2] = lerp(result.target[2], target.z, weight);
    }
    return result;
  };
  return transitionCamera(
    pose(previous),
    pose(chapter),
    time - chapter.start,
    Math.min(5, chapter.director.transition),
    previous.director?.view === "first",
    chapter.director.view === "first",
  );
}
