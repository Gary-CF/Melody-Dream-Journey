import { segmentBox, type Bounds3, type Vec3 } from "./spatial";
import { clipObservationTriangle, type SubjectRegion } from "./composition";

/** CPU-only, immutable geometry captured before renderer batching. */
export interface SightSurface {
  id: string;
  instanceId: string;
  subjectId?: string;
  hiddenInViews: readonly string[];
  bounds: Bounds3;
  triangles: Float32Array;
  dynamic: boolean;
  /** A transparent feature's actual surface can be observed without occluding others. */
  observationOnly?: boolean;
}
export interface SightHit {
  surfaceId: string;
  instanceId: string;
  point: Vec3;
  fraction: number;
  certainty: "triangle" | "dynamic-bound";
}
export interface SightQuery {
  origin: Vec3;
  target: Vec3;
  viewId: string;
  subjectId?: string;
}
const sub = (a: Vec3, b: Vec3): Vec3 => a.map((v, i) => v - b[i]) as Vec3;
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3) => a.reduce((v, x, i) => v + x * b[i], 0);

/** Double-sided finite segment/triangle intersection; shared edges count once.
 * No material or scene-name exceptions; degenerate triangles cannot occlude.
 */
export function triangleFraction(
  origin: Vec3,
  target: Vec3,
  a: Vec3,
  b: Vec3,
  c: Vec3,
): number | undefined {
  const direction = sub(target, origin),
    e1 = sub(b, a),
    e2 = sub(c, a),
    p = cross(direction, e2),
    det = dot(e1, p);
  if (Math.abs(det) < 1e-10) return;
  const inv = 1 / det,
    t = sub(origin, a),
    u = dot(t, p) * inv;
  if (u < -1e-7 || u > 1 + 1e-7) return;
  const q = cross(t, e1),
    v = dot(direction, q) * inv;
  if (v < -1e-7 || u + v > 1 + 1e-7) return;
  const fraction = dot(e2, q) * inv;
  return fraction > 1e-5 && fraction < 1 - 1e-5 ? fraction : undefined;
}

export function traceSight(
  query: SightQuery,
  surfaces: readonly SightSurface[],
): SightHit | undefined {
  let closest: SightHit | undefined;
  for (const surface of surfaces) {
    if (
      surface.observationOnly ||
      surface.hiddenInViews.includes(query.viewId) ||
      (query.subjectId && query.subjectId === surface.subjectId)
    )
      continue;
    const broad = segmentBox(query.origin, query.target, surface.bounds);
    if (broad === undefined || (closest && broad > closest.fraction)) continue;
    let fraction: number | undefined = surface.dynamic ? broad : undefined;
    if (!surface.dynamic)
      for (let i = 0; i < surface.triangles.length; i += 9) {
        const v = surface.triangles;
        const hit = triangleFraction(
          query.origin,
          query.target,
          [v[i], v[i + 1], v[i + 2]],
          [v[i + 3], v[i + 4], v[i + 5]],
          [v[i + 6], v[i + 7], v[i + 8]],
        );
        if (hit !== undefined && (fraction === undefined || hit < fraction))
          fraction = hit;
      }
    if (fraction !== undefined && (!closest || fraction < closest.fraction))
      closest = {
        surfaceId: surface.id,
        instanceId: surface.instanceId,
        fraction,
        certainty: surface.dynamic ? "dynamic-bound" : "triangle",
        point: query.origin.map(
          (v, i) => v + (query.target[i] - v) * fraction,
        ) as Vec3,
      };
  }
  return closest;
}

/** Area-stratified points on actual subject triangles, not empty bounding-box corners. */
export function subjectSamples(
  surfaces: readonly SightSurface[],
  subjectId: string,
  count = 12,
  region?: SubjectRegion,
): Vec3[] {
  const triangles: { point: Vec3; end: number }[] = [];
  let total = 0;
  for (const s of surfaces)
    if (s.subjectId === subjectId && !s.dynamic)
      for (let i = 0; i < s.triangles.length; i += 9) {
        const v = s.triangles,
          a: Vec3 = [v[i], v[i + 1], v[i + 2]],
          b: Vec3 = [v[i + 3], v[i + 4], v[i + 5]],
          c: Vec3 = [v[i + 6], v[i + 7], v[i + 8]];
        const polygon = clipObservationTriangle(a, b, c, region);
        for (let j = 1; j + 1 < polygon.length; j++) {
          const [pa, pb, pc] = [polygon[0], polygon[j], polygon[j + 1]];
          const area = Math.hypot(...cross(sub(pb, pa), sub(pc, pa))) * 0.5;
          if (area < 1e-9) continue;
          total += area;
          triangles.push({
            point: pa.map((x, axis) => (x + pb[axis] + pc[axis]) / 3) as Vec3,
            end: total,
          });
        }
      }
  if (!triangles.length) return [];
  const samples: Vec3[] = [];
  let cursor = 0;
  for (let i = 0; i < count; i++) {
    const at = (total * (i + 0.5)) / count;
    while (cursor < triangles.length - 1 && triangles[cursor].end < at)
      cursor++;
    samples.push([...triangles[cursor].point]);
  }
  return samples;
}

export function subjectVertices(
  surfaces: readonly SightSurface[],
  subjectId: string,
  region?: SubjectRegion,
): Vec3[] {
  const unique = new Map<string, Vec3>();
  for (const surface of surfaces) {
    if (surface.subjectId !== subjectId || surface.dynamic) continue;
    const v = surface.triangles;
    for (let i = 0; i < v.length; i += 9)
      for (const point of clipObservationTriangle(
        [v[i], v[i + 1], v[i + 2]],
        [v[i + 3], v[i + 4], v[i + 5]],
        [v[i + 6], v[i + 7], v[i + 8]],
        region,
      ))
        unique.set(point.map((n) => n.toFixed(5)).join(","), point);
  }
  return [...unique.values()];
}
