import * as T from "three";
import type { Kit } from "./assets";
import { routeProfile, routeOffset, type Segment } from "./path";
import type { Sequence } from "./sequences";
import { physical } from "./spatial-adapter";

/** A continuous walkable connection follows the same cubic detour reserved by
 * physics. It is owned by the fixed passage, never moved by scenic layout repair. */
export function buildPassageWalkway(
  k: Kit,
  root: T.Group,
  path: Segment[],
  sequence: Sequence,
) {
  const profile = routeProfile(path, sequence);
  const count = Math.ceil((profile.outer * 2) / 0.65);
  for (let i = 0; i < count; i++) {
    const z = -profile.outer + (i / count) * profile.outer * 2;
    const next = -profile.outer + ((i + 1) / count) * profile.outer * 2;
    const x = routeOffset(path, sequence, z),
      nx = routeOffset(path, sequence, next);
    const plank = k.box(
      root,
      "#a99477",
      (x + nx) / 2,
      0.13,
      (z + next) / 2,
      2.8,
      0.18,
      Math.hypot(nx - x, next - z) + 0.045,
    );
    plank.rotation.y = Math.atan2(nx - x, next - z);
    physical(plank, "support");
  }
}
