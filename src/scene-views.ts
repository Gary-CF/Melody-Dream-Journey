import { cameraPair } from "./player-camera";
import type { Segment } from "./path";
import type { SpatialProxy } from "./domain/spatial";
import { clearOverhead, inspectView } from "./domain/camera-clearance";
import { observerCameraRadius } from "./domain/observer-space";
import { composeSequence, type SequenceScene } from "./sequence-scene";
import {
  inspectFraming,
  type ShotIntent,
  type SightProvider,
} from "./domain/shot-intent";
import { phaseAt, revealAt } from "./sequences";
import type { CameraProgram } from "./camera-program";
import { scoreFrame } from "./domain/cinematic-score";

export function sceneIntent(
  node: SequenceScene | undefined,
  time: number,
): ShotIntent {
  if (!node)
    return {
      id: "travel",
      kind: "direction",
      phase: "travel",
      subjectIds: [],
      required: false,
      minimumVisibleFraction: 0.5,
    };
  const phase = phaseAt(node.sequence, time);
  const score = node.sequence.composition?.score;
  const stage = score
    ? scoreFrame(score, time - node.sequence.start).phase
    : undefined;
  return {
    id: node.sequence.id,
    kind: node.focusKind,
    phase: stage
      ? stage === "approach" || stage === "buildup"
        ? "approach"
        : stage === "release"
          ? "release"
          : "reveal"
      : phase < 0.16
        ? "approach"
        : phase > 0.72
          ? "release"
          : "reveal",
    subjectIds: node.focusSubjects,
    subjects: node.subjectComposition,
    required:
      node.focusKind === "subject" && revealAt(node.sequence, time) > 0.92,
    minimumVisibleFraction: 0.5,
  };
}
export function inspectSceneFraming(
  pair: ReturnType<typeof sceneViews>["pair"],
  intent: ShotIntent,
  provider: SightProvider,
  aspect = 16 / 9,
) {
  return {
    first: inspectFraming(pair.first, intent, provider, "first", aspect),
    overhead: inspectFraming(
      pair.overhead,
      intent,
      provider,
      "overhead",
      aspect,
    ),
  };
}

/** One evaluator serves playback, seek, paired view and the developer audit. */
export function sceneViews(
  path: Segment[],
  scale: number,
  time: number,
  scenes: readonly SequenceScene[],
  proxies: readonly SpatialProxy[],
  program?: CameraProgram,
) {
  let pair = cameraPair(path, time, scale);
  const node = scenes.find(
    (n) => time >= n.sequence.start && time <= n.sequence.end,
  );
  if (node)
    pair = composeSequence(
      pair,
      node,
      time,
      program?.shots.get(node.sequence.id)?.composition,
    );
  const before = pair.overhead.position[1];
  const overhead = clearOverhead(pair.overhead, proxies);
  pair.overhead.position = overhead.position;
  return {
    pair,
    node,
    heightAdjustment: overhead.position[1] - before,
    unresolved: overhead.unresolved,
  };
}
export function inspectSceneViews(
  pair: ReturnType<typeof sceneViews>["pair"],
  proxies: readonly SpatialProxy[],
  subjectIds: readonly string[] = [],
) {
  return {
    first: inspectView(pair.first, proxies, observerCameraRadius, true, {
      viewId: "first",
      subjectIds,
    }),
    overhead: inspectView(pair.overhead, proxies, observerCameraRadius, true, {
      viewId: "overhead",
      subjectIds,
    }),
  };
}
