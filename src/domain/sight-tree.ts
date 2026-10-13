import { segmentBox, type Bounds3 } from "./spatial";
import { traceSight, type SightQuery, type SightSurface } from "./visibility";

interface SightNode {
  bounds: Bounds3;
  left?: SightNode;
  right?: SightNode;
  surfaces?: readonly SightSurface[];
}
/** Immutable broad phase over copied CPU surfaces. Leaves still use the same
 * exact triangle/dynamic-bound evaluator, so view and subject semantics do not change. */
export class SightTree {
  private root?: SightNode;
  private order = new Map<SightSurface, number>();
  constructor(surfaces: readonly SightSurface[]) {
    surfaces.forEach((surface, index) => this.order.set(surface, index));
    if (surfaces.length) this.root = this.build([...surfaces]);
  }
  private build(surfaces: SightSurface[]): SightNode {
    const bounds: Bounds3 = {
      min: [Infinity, Infinity, Infinity],
      max: [-Infinity, -Infinity, -Infinity],
    };
    for (const s of surfaces)
      for (let i = 0; i < 3; i++) {
        bounds.min[i] = Math.min(bounds.min[i], s.bounds.min[i]);
        bounds.max[i] = Math.max(bounds.max[i], s.bounds.max[i]);
      }
    if (surfaces.length <= 12) return { bounds, surfaces };
    const span = bounds.max.map((x, i) => x - bounds.min[i]),
      axis = span.indexOf(Math.max(...span));
    surfaces.sort(
      (a, b) =>
        a.bounds.min[axis] +
        a.bounds.max[axis] -
        (b.bounds.min[axis] + b.bounds.max[axis]),
    );
    const mid = Math.floor(surfaces.length / 2);
    return {
      bounds,
      left: this.build(surfaces.slice(0, mid)),
      right: this.build(surfaces.slice(mid)),
    };
  }
  trace(query: SightQuery) {
    const candidates: SightSurface[] = [];
    const visit = (node: SightNode | undefined) => {
      if (
        !node ||
        segmentBox(query.origin, query.target, node.bounds) === undefined
      )
        return;
      if (node.surfaces) candidates.push(...node.surfaces);
      else {
        visit(node.left);
        visit(node.right);
      }
    };
    visit(this.root);
    // Preserve the exhaustive evaluator's tie-break at coincident surfaces.
    candidates.sort((a, b) => this.order.get(a)! - this.order.get(b)!);
    return traceSight(query, candidates);
  }
}
