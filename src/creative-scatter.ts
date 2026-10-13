import * as T from "three";
import type { Kit } from "./assets";
import { coreAssets } from "./core-catalog";
import { duration, rng, type Plan } from "./model";
import type { Segment } from "./path";
import type { PlacementSession } from "./placement";
import { decorationWindows, decorationSites } from "./domain/decoration-layout";
import { shoreSupport } from "./shore-support";
import { releaseCandidate } from "./spatial-adapter";

/** Versioned world decorations have one distance-based distribution across
 * adjacent lighting chapters. All objects still pass the shared spatial gate. */
export function scatterCreativeDecorations(
  kit: Kit,
  plan: Plan,
  path: Segment[],
  placement: PlacementSession,
  root: T.Group,
) {
  const accepted: T.Group[] = [],
    random = rng(plan.seed + 591);
  const occupied: { x: number; z: number; radius: number }[] = [];
  for (const window of decorationWindows(plan.chapters, duration(plan))) {
    const recipe =
      plan.library.find((r) => r.id === window.id) ??
      coreAssets.find((r) => r.id === window.id);
    if (!recipe) continue;
    const backdrop = recipe.placement === "backdrop",
      radius = recipe.footprint;
    const sites = decorationSites(
      path,
      window,
      radius,
      plan.creativeWorld!.recipe.density,
    );
    for (const [i, site] of sites.entries()) {
      if (accepted.length >= 100) break;
      const side = i % 2 ? -1 : 1,
        nx = site.dz * side,
        nz = -site.dx * side;
      const offset =
        plan.visual.roadWidth / 2 + radius + (backdrop ? 38 : 5) + random() * 8;
      const x = site.x + nx * offset,
        z = site.z + nz * offset;
      if (
        occupied.some(
          (p) => Math.hypot(x - p.x, z - p.z) < radius + p.radius + 4,
        )
      )
        continue;
      const group = kit.create(recipe.id);
      group.position.set(x, recipe.placement === "water" ? -0.28 : 0, z);
      group.rotation.y = Math.atan2(-nx, -nz);
      if (backdrop) group.scale.setScalar(0.68 + random() * 0.16);
      group.userData.range = backdrop ? 290 : 190;
      if (
        recipe.placement !== "water" &&
        plan.creativeWorld!.recipe.terrain === "waterfront"
      ) {
        const bounds = new T.Box3().setFromObject(group),
          size = bounds.getSize(new T.Vector3());
        group.add(
          shoreSupport(
            Math.max(3, size.x * 0.6),
            Math.max(3, size.z * 0.6),
            plan.seed + i * 31,
          ),
        );
      }
      const record = placement.place(
        `world-decoration/${recipe.id}/${window.start}/${i}`,
        group,
        [
          [0, 0, 0],
          [nx * 15, 0, nz * 15],
          [nx * 35, 0, nz * 35],
        ],
      );
      if (record.status === "rejected") {
        releaseCandidate(group);
        continue;
      }
      occupied.push({ x: group.position.x, z: group.position.z, radius });
      root.add(group);
      accepted.push(group);
    }
  }
  return accepted;
}
