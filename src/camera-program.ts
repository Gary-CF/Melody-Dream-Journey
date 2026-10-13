import type { Segment } from "./path";
import { cameraPair } from "./player-camera";
import { composeSequence, type SequenceScene } from "./sequence-scene";
import {
  inspectFraming,
  primaryPresence,
  type ShotIntent,
  type SightProvider,
  type ShotView,
} from "./domain/shot-intent";
import {
  cameraCandidates,
  selectCamera,
  type CameraSelection,
  type CameraLimits,
} from "./domain/camera-candidates";
import { clearOverhead, inspectView } from "./domain/camera-clearance";
import type { SpatialProxy, Vec3 } from "./domain/spatial";
import { revealAt, sequenceStop } from "./sequences";
import type { SightHit } from "./domain/visibility";
import { observerCameraRadius } from "./domain/observer-space";
import { centeredAim } from "./domain/composition";
export interface ShotComposition {
  first: ShotView;
  overhead: ShotView;
}
export interface CompiledShot {
  sequenceId: string;
  at: number;
  checkedTimes: number[];
  composition: ShotComposition;
  selections: { first: CameraSelection; overhead: CameraSelection };
}
export interface CameraProgram {
  aspect: number;
  shots: ReadonlyMap<string, CompiledShot>;
}
export function compileCameraProgram(
  path: Segment[],
  scale: number,
  scenes: readonly SequenceScene[],
  proxies: readonly SpatialProxy[],
  sight: SightProvider,
  aspect: number,
): CameraProgram {
  const shots = new Map<string, CompiledShot>();
  // Candidate FOV/aim variations often repeat identical surface rays. This
  // build-local memo is released after compilation; it is not a runtime cache.
  const rays = new Map<string, SightHit | undefined>();
  // Clearance depends on eye position and ownership, not aim or FOV. Many
  // candidates share it; never repeat whole-world proxy scans for those poses.
  const clearance = new Map<string, ReturnType<typeof clearOverhead>>();
  const clearAt = (view: ShotView, viewId: "first" | "overhead") => {
    const key = JSON.stringify([viewId, view.position]);
    let result = clearance.get(key);
    if (!result) {
      result =
        viewId === "overhead"
          ? clearOverhead(view, proxies)
          : {
              position: view.position,
              adjusted: false,
              unresolved: inspectView(
                view,
                proxies,
                observerCameraRadius,
                false,
              ),
            };
      clearance.set(key, result);
    }
    return result;
  };
  const cachedSight: SightProvider = {
    samples: (id, viewId, region) => sight.samples(id, viewId, region),
    vertices: sight.vertices
      ? (id, viewId, region) => sight.vertices!(id, viewId, region)
      : undefined,
    trace: (query) => {
      const key = JSON.stringify(query);
      if (!rays.has(key)) rays.set(key, sight.trace(query));
      return rays.get(key);
    },
  };
  for (const scene of scenes) {
    if (scene.focusKind !== "subject") continue;
    const at = scene.sequence.composition?.score
      ? sequenceStop(scene.sequence)
      : scene.sequence.start +
        (scene.sequence.end - scene.sequence.start) * 0.55;
    const pair = composeSequence(cameraPair(path, at, scale), scene, at);
    if (scene.sequence.composition && aspect < 1) {
      // Both public views own a responsive lens. Previously only the attached
      // eye compensated for portrait width, leaving the shared overhead crop
      // impossible even when moving the assembly harmed the first-person shot.
      for (const view of [pair.first, pair.overhead])
        view.fov = Math.min(
          85,
          (Math.atan(
            Math.tan((view.fov * Math.PI) / 360) / Math.max(0.5, aspect),
          ) *
            360) /
            Math.PI,
        );
    }
    // Bounded temporal audit, distinct from a continuous visibility proof.
    // Include both edges of the required reveal interval and the center.
    const length = scene.sequence.end - scene.sequence.start;
    const steps = Math.min(80, Math.max(20, Math.ceil(length * 2)));
    const checkedTimes = [at];
    for (let i = 0; i <= steps; i++) {
      const time = scene.sequence.start + (length * i) / steps;
      if (revealAt(scene.sequence, time) > 0.92 && Math.abs(time - at) > 1e-6)
        checkedTimes.push(time);
      if (i > 0) {
        const previous = scene.sequence.start + (length * (i - 1)) / steps;
        const wasRequired = revealAt(scene.sequence, previous) > 0.92;
        const isRequired = revealAt(scene.sequence, time) > 0.92;
        if (wasRequired !== isRequired) {
          let low = previous,
            high = time;
          for (let k = 0; k < 28; k++) {
            const mid = (low + high) / 2;
            if (revealAt(scene.sequence, mid) > 0.92 === wasRequired) low = mid;
            else high = mid;
          }
          checkedTimes.push((low + high) / 2 + (isRequired ? 1e-5 : -1e-5));
        }
      }
    }
    checkedTimes.sort((a, b) => a - b);
    const timedPairs = new Map(
      checkedTimes.map((time) => [time, cameraPair(path, time, scale)]),
    );
    const freshPair = (time: number) => {
      const p = timedPairs.get(time)!;
      return { first: { ...p.first }, overhead: { ...p.overhead } };
    };
    const baselines = new Map(
      checkedTimes.map((time) => [
        time,
        composeSequence(freshPair(time), scene, time),
      ]),
    );
    const intent: ShotIntent = {
      id: scene.sequence.id,
      kind: "subject",
      phase: "reveal",
      subjectIds: scene.focusSubjects,
      subjects: scene.subjectComposition,
      required: true,
      minimumVisibleFraction: 0.5,
    };
    const choose = (viewId: "first" | "overhead") => {
      const points = scene.focusSubjects.flatMap((id) => {
        const policy = scene.subjectComposition?.find(
          (s) => s.subjectId === id,
        );
        if (policy?.views && !policy.views.includes(viewId)) return [];
        const region = policy?.region;
        return [
          ...(sight.vertices?.(id, viewId, region) ??
            sight.samples(id, viewId, region)),
        ];
      });
      const min: Vec3 = [Infinity, Infinity, Infinity],
        max: Vec3 = [-Infinity, -Infinity, -Infinity];
      for (const point of points)
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], point[i]);
          max[i] = Math.max(max[i], point[i]);
        }
      const targets: Vec3[] = points.length
        ? [
            points.reduce(
              (sum, p) => sum.map((x, i) => x + p[i] / points.length) as Vec3,
              [0, 0, 0] as Vec3,
            ),
            min.map((x, i) => (x + max[i]) / 2) as Vec3,
          ]
        : [];
      const base = pair[viewId];
      if (points.length) {
        targets.push(centeredAim(base, points, aspect));
        const endpoints = [checkedTimes[0], checkedTimes.at(-1)!].map((time) =>
          centeredAim(
            composeSequence(cameraPair(path, time, scale), scene, time)[viewId],
            points,
            aspect,
          ),
        );
        targets.push(
          endpoints[0].map((x, i) => (x + endpoints[1][i]) / 2) as Vec3,
        );
      }
      const limits: CameraLimits = {
        lockedEye: viewId === "first",
        maxYawDegrees: 24,
        maxLift: 12,
        maxAimDegrees: 28,
        maxFovIncrease: 8,
        ...(viewId === "first" &&
        scene.subjectComposition?.some((s) => s.minimumSpan?.first)
          ? { maxFovDecrease: 16 }
          : {}),
      };
      return selectCamera(
        cameraCandidates(base, targets, limits),
        (candidate) => {
          const clear = clearAt(candidate.view, viewId);
          const view = { ...candidate.view, position: clear.position };
          const lift = clear.position[1] - candidate.view.position[1];
          const composition = { ...pair, [viewId]: view };
          const checks = checkedTimes.map((time) => {
            const timed = composeSequence(
              freshPair(time),
              scene,
              time,
              composition,
            )[viewId];
            const guard = clearAt(timed, viewId);
            const framing = inspectFraming(
              { ...timed, position: guard.position },
              intent,
              cachedSight,
              viewId,
              aspect,
            );
            const baseline = baselines.get(time)![viewId];
            return {
              time,
              bodyClear: guard.unresolved.length === 0,
              withinBudget:
                guard.position[1] - baseline.position[1] <=
                limits.maxLift + 0.05,
              framing,
            };
          });
          // Preserve the worst evidence, including unknown geometry, instead of
          // claiming the center pose certifies the whole reveal.
          const worst = [...checks].sort((a, b) => {
            const rank = (c: typeof a) =>
              c.framing.status === "visible"
                ? 2
                : c.framing.status === "unknown"
                  ? 0
                  : 1;
            return (
              rank(a) - rank(b) ||
              a.framing.visibleFraction - b.framing.visibleFraction
            );
          })[0];
          return {
            view,
            bodyClear:
              clear.unresolved.length === 0 && checks.every((c) => c.bodyClear),
            withinBudget:
              clear.position[1] - base.position[1] <= limits.maxLift + 0.05 &&
              checks.every((c) => c.withinBudget),
            clearanceLift: lift,
            framing: worst.framing,
            window: checks.map((c) => ({
              time: c.time,
              bodyClear: c.bodyClear,
              withinBudget: c.withinBudget,
              status: c.framing.status,
              visibleFraction: c.framing.visibleFraction,
              inFrameFraction: c.framing.inFrameFraction,
              ...primaryPresence(c.framing),
            })),
          };
        },
      );
    };
    const first = choose("first"),
      overhead = choose("overhead");
    shots.set(scene.sequence.id, {
      sequenceId: scene.sequence.id,
      at,
      checkedTimes,
      selections: { first, overhead },
      composition: {
        first: first.selected.view,
        overhead: overhead.selected.view,
      },
    });
  }
  return { aspect, shots };
}
