import type { Vec3 } from "./spatial";

/** A world-space observation region. Clipping affects observation only; physical
 * proxies and occluders always retain the complete solid geometry. Units: metres. */
export interface SubjectRegion {
  minimumY?: number;
}
export interface SubjectComposition {
  /** Observation changes by view; the physical world and occluders do not. */
  views?: ("first" | "overhead")[];
  subjectId: string;
  role: "primary" | "supporting";
  region?: SubjectRegion;
  crop: "contain" | "coverage";
  viewCrop?: {
    first?: "contain" | "coverage";
    overhead?: "contain" | "coverage";
  };
  /** Minimum longest screen span, measured as a fraction of the full frame.
   * Explicit per-view intent; legacy compositions have no size requirement. */
  minimumSpan?: { first?: number; overhead?: number };
  /** Fraction of the half-frame reserved at each edge, in normalized device coordinates. */
  margin: { landscape: number; portrait: number };
}
export interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
}
export interface CompositionBounds {
  min: [number, number];
  max: [number, number];
  clippedPoints: number;
  pointCount: number;
  overflow: number;
  margin: number;
  depth: [number, number];
}
const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(...v) || 1;
  return v.map((x) => x / length) as Vec3;
};
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, x, i) => sum + x * b[i], 0);
export function projectPoint(
  view: { position: Vec3; target: Vec3; fov: number },
  point: Vec3,
  aspect: number,
): ProjectedPoint {
  return pointProjector(view, aspect)(point);
}
/** One camera basis per batch, not one per vertex. */
function pointProjector(
  view: { position: Vec3; target: Vec3; fov: number },
  aspect: number,
): (point: Vec3) => ProjectedPoint {
  const forward = normalize(
    view.target.map((x, i) => x - view.position[i]) as Vec3,
  );
  const right = normalize(
    Math.hypot(forward[0], forward[2]) < 1e-8
      ? [1, 0, 0]
      : [-forward[2], 0, forward[0]],
  );
  const up: Vec3 = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  const tangent = Math.tan((view.fov * Math.PI) / 360);
  return (point) => {
    const x = point[0] - view.position[0],
      y = point[1] - view.position[1],
      z = point[2] - view.position[2];
    const depth = x * forward[0] + y * forward[1] + z * forward[2];
    const half = depth * tangent;
    return {
      x: (x * right[0] + y * right[1] + z * right[2]) / (half * aspect),
      y: (x * up[0] + y * up[1] + z * up[2]) / half,
      depth,
    };
  };
}
/** Actual mesh vertices, including intersections with the observation plane,
 * bound the projected triangles. A surface coverage average cannot certify this. */
export function compositionBounds(
  view: { position: Vec3; target: Vec3; fov: number },
  points: readonly Vec3[],
  aspect: number,
  margin: number,
): CompositionBounds | undefined {
  if (!points.length) return;
  const min: [number, number] = [Infinity, Infinity],
    max: [number, number] = [-Infinity, -Infinity];
  let clippedPoints = 0,
    overflow = 0;
  const depth: [number, number] = [Infinity, -Infinity];
  const project = pointProjector(view, aspect);
  for (const point of points) {
    const projected = project(point);
    depth[0] = Math.min(depth[0], projected.depth);
    depth[1] = Math.max(depth[1], projected.depth);
    min[0] = Math.min(min[0], projected.x);
    min[1] = Math.min(min[1], projected.y);
    max[0] = Math.max(max[0], projected.x);
    max[1] = Math.max(max[1], projected.y);
    const outside =
      Math.max(Math.abs(projected.x), Math.abs(projected.y)) - (1 - margin);
    if (projected.depth <= 0.1 || projected.depth > 450 || outside > 1e-6)
      clippedPoints++;
    overflow = Math.max(overflow, projected.depth <= 0.1 ? 100 : outside);
  }
  return {
    min,
    max,
    clippedPoints,
    pointCount: points.length,
    overflow,
    margin,
    depth,
  };
}

/** Center a set of projected vertices, not their world-space arithmetic mean.
 * Perspective makes those different, especially for deep subject clusters.
 * The caller still enforces its own angular and FOV budgets. */
export function centeredAim(
  view: { position: Vec3; target: Vec3; fov: number },
  points: readonly Vec3[],
  aspect: number,
): Vec3 {
  let target: Vec3 = [...view.target];
  const distance = Math.hypot(...target.map((x, i) => x - view.position[i]));
  for (let i = 0; i < 4; i++) {
    const bounds = compositionBounds({ ...view, target }, points, aspect, 0);
    if (!bounds || bounds.depth[0] <= 0.1) break;
    const forward = normalize(
      target.map((x, j) => x - view.position[j]) as Vec3,
    );
    const right = normalize(
      Math.hypot(forward[0], forward[2]) < 1e-8
        ? [1, 0, 0]
        : [-forward[2], 0, forward[0]],
    );
    const up: Vec3 = [
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0],
    ];
    const tangent = Math.tan((view.fov * Math.PI) / 360);
    const x = (bounds.min[0] + bounds.max[0]) * 0.5 * tangent * aspect;
    const y = (bounds.min[1] + bounds.max[1]) * 0.5 * tangent;
    const next = normalize(
      forward.map((v, j) => v + right[j] * x + up[j] * y) as Vec3,
    );
    target = view.position.map((v, j) => v + next[j] * distance) as Vec3;
  }
  return target;
}

/** Sutherland–Hodgman clip against an explicit ground/water observation plane. */
export function clipObservationTriangle(
  a: Vec3,
  b: Vec3,
  c: Vec3,
  region?: SubjectRegion,
): Vec3[] {
  if (region?.minimumY === undefined) return [a, b, c];
  const floor = region.minimumY,
    points = [a, b, c],
    result: Vec3[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i],
      q = points[(i + 1) % points.length];
    if (p[1] >= floor) result.push(p);
    if (p[1] >= floor !== q[1] >= floor) {
      const t = (floor - p[1]) / (q[1] - p[1]);
      result.push(p.map((x, axis) => x + (q[axis] - x) * t) as Vec3);
    }
  }
  return result;
}
