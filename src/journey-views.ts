import type { Plan } from "./model";
import type { Segment } from "./path";
import type { SpatialProxy } from "./domain/spatial";
import { clearOverhead, inspectView } from "./domain/camera-clearance";
import { legacyCamera } from "./legacy-camera";
import { sceneViews } from "./scene-views";
import { composeSequence, type SequenceScene } from "./sequence-scene";
import type { CameraProgram } from "./camera-program";
import { observerCameraRadius } from "./domain/observer-space";

/** Every public camera mode goes through the same absolute-time composition and
 * physical-clearance boundary. No frame-history interpolation after validation.
 */
export function journeyViews(
  p: Plan,
  path: Segment[],
  time: number,
  energy: number,
  scenes: readonly SequenceScene[],
  proxies: readonly SpatialProxy[],
  program?: CameraProgram,
) {
  const selected = sceneViews(
    path,
    p.visual.observerScale,
    time,
    scenes,
    proxies,
    program,
  );
  const automatic = legacyCamera(p, path, time, energy);
  let track = automatic.track;
  if (selected.node) {
    const pair = composeSequence(
      { first: structuredClone(track), overhead: structuredClone(track) },
      selected.node,
      time,
      program?.shots.get(selected.node.sequence.id)?.composition,
    );
    track = automatic.eyeAttached ? pair.first : pair.overhead;
  }
  const before = track.position[1];
  const clear = automatic.eyeAttached
    ? {
        position: track.position,
        unresolved: inspectView(track, proxies, observerCameraRadius, false),
      }
    : clearOverhead(track, proxies);
  track = { ...track, position: clear.position };
  return {
    ...selected,
    auto: track,
    autoHeightAdjustment: track.position[1] - before,
    autoUnresolved: clear.unresolved,
    autoEyeAttached: automatic.eyeAttached,
    autoHeroVisible: automatic.heroVisible,
    autoTransition: automatic.transition,
    autoVisibilityView: automatic.eyeAttached ? "first" : "overhead",
  };
}
