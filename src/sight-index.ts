import {
  subjectSamples,
  subjectVertices,
  type SightSurface,
  type SightQuery,
} from "./domain/visibility";
import type { Vec3 } from "./domain/spatial";
import type { SightProvider } from "./domain/shot-intent";
import type { SubjectRegion } from "./domain/composition";
import { SightTree } from "./domain/sight-tree";

/** Candidate-owned CPU index. Sample extraction is cached; ray queries remain
 * independent of mutable meshes, rendering batches, frame history or WebGL.
 */
export class SightIndex implements SightProvider {
  private cache = new Map<string, readonly Vec3[]>();
  private tree?: SightTree;
  constructor(readonly surfaces: readonly SightSurface[]) {}
  trace(query: SightQuery) {
    this.tree ??= new SightTree(this.surfaces);
    return this.tree.trace(query);
  }
  samples(id: string, viewId?: string, region?: SubjectRegion) {
    return this.geometry(id, viewId, region, "samples");
  }
  vertices(id: string, viewId?: string, region?: SubjectRegion) {
    return this.geometry(id, viewId, region, "vertices");
  }
  private geometry(
    id: string,
    viewId: string | undefined,
    region: SubjectRegion | undefined,
    kind: "samples" | "vertices",
  ) {
    const key = JSON.stringify([kind, id, viewId ?? null, region ?? null]);
    let samples = this.cache.get(key);
    if (!samples) {
      const surfaces = viewId
        ? this.surfaces.filter((s) => !s.hiddenInViews.includes(viewId))
        : this.surfaces;
      samples =
        kind === "samples"
          ? subjectSamples(surfaces, id, 12, region)
          : subjectVertices(surfaces, id, region);
      this.cache.set(key, samples);
    }
    return samples;
  }
  dispose() {
    this.cache.clear();
    this.tree = undefined;
  }
}
