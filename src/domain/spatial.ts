/** Portable, conservative spatial contracts. Coordinates are metres, Y is up. */
export type Vec3 = [number, number, number];
export interface Bounds3 {
  min: Vec3;
  max: Vec3;
}
export type PhysicalRole = "solid" | "support" | "decoration";
export interface SpatialProxy {
  id: string;
  instanceId: string;
  role: PhysicalRole;
  bounds: Bounds3;
  /** Optional semantic owner for view diagnostics, independent of collision. */
  subjectId?: string;
  hiddenInViews?: readonly string[];
}
export interface Sweep {
  id: string;
  start: number;
  end: number;
  a: Vec3;
  b: Vec3;
  /** Axis-aligned half extents include the body's size and any curve error. */
  padding: Vec3;
}
export interface SpatialIssue {
  code: "route-obstructed" | "invalid-spatial-data" | "space-overlap";
  instanceId: string;
  proxyId: string;
  reservationId: string;
  timeRange: [number, number];
  point: Vec3;
  message: string;
}
export const finite3 = (v: Vec3) => v.length === 3 && v.every(Number.isFinite);
export function validBounds(b: Bounds3) {
  return (
    finite3(b.min) && finite3(b.max) && b.min.every((v, i) => v <= b.max[i])
  );
}
/** Slab intersection includes stationary sweeps, corners and tangency. */
export function segmentBox(
  a: Vec3,
  b: Vec3,
  box: Bounds3,
  padding: Vec3 = [0, 0, 0],
): number | undefined {
  let enter = 0,
    leave = 1;
  for (let axis = 0; axis < 3; axis++) {
    const lo = box.min[axis] - padding[axis],
      hi = box.max[axis] + padding[axis];
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-12) {
      if (a[axis] < lo || a[axis] > hi) return;
    } else {
      const u = (lo - a[axis]) / delta,
        v = (hi - a[axis]) / delta;
      enter = Math.max(enter, Math.min(u, v));
      leave = Math.min(leave, Math.max(u, v));
      if (enter > leave) return;
    }
  }
  return enter;
}
export function validatePlacement(
  proxies: readonly SpatialProxy[],
  reservations: readonly Sweep[],
): SpatialIssue[] {
  const issues: SpatialIssue[] = [];
  for (const s of reservations) {
    if (
      !finite3(s.a) ||
      !finite3(s.b) ||
      !finite3(s.padding) ||
      s.padding.some((v) => v < 0) ||
      !Number.isFinite(s.start) ||
      !Number.isFinite(s.end) ||
      s.start > s.end
    ) {
      issues.push({
        code: "invalid-spatial-data",
        instanceId: "",
        proxyId: "",
        reservationId: s.id,
        timeRange: [0, 0],
        point: [0, 0, 0],
        message: "Invalid route reservation",
      });
    }
  }
  if (issues.length) return issues;
  for (const p of proxies) {
    if (
      !validBounds(p.bounds) ||
      !["solid", "support", "decoration"].includes(p.role)
    ) {
      issues.push({
        code: "invalid-spatial-data",
        instanceId: p.instanceId,
        proxyId: p.id,
        reservationId: "",
        timeRange: [0, 0],
        point: [0, 0, 0],
        message: "Nonfinite/inverted bounds or unknown physical role",
      });
      continue;
    }
    if (p.role === "decoration") continue;
    for (const s of reservations) {
      // A support may meet the soles, but a raised platform cannot occupy the torso.
      if (
        p.role === "support" &&
        p.bounds.max[1] <= Math.min(s.a[1], s.b[1]) - s.padding[1] + 0.06
      )
        continue;
      const u = segmentBox(s.a, s.b, p.bounds, s.padding);
      if (u === undefined) continue;
      issues.push({
        code: "route-obstructed",
        instanceId: p.instanceId,
        proxyId: p.id,
        reservationId: s.id,
        timeRange: [s.start, s.end],
        point: s.a.map((v, i) => v + (s.b[i] - v) * u) as Vec3,
        message: "Solid overlaps the continuous reserved corridor",
      });
      break;
    }
  }
  return issues;
}
/** Cubic Bézier convex hull bounds the curve; subdivision only improves tightness. */
export function reserveCubic(
  id: string,
  controls: [Vec3, Vec3, Vec3, Vec3],
  padding: Vec3,
  timeRange: [number, number],
  tolerance = 0.035,
): Sweep[] {
  if (
    !controls.every(finite3) ||
    !finite3(padding) ||
    padding.some((v) => v < 0) ||
    !(tolerance > 0)
  )
    throw Error("Invalid curve reservation");
  const result: Sweep[] = [];
  const mid = (a: Vec3, b: Vec3) => a.map((v, i) => (v + b[i]) / 2) as Vec3;
  function split(c: [Vec3, Vec3, Vec3, Vec3], depth: number, suffix: string) {
    // Convex combination of deviations from the matching linear control polygon.
    const error = c[0].map((_, axis) =>
      Math.max(
        ...c.map((v, i) =>
          Math.abs(
            v[axis] - (c[0][axis] + ((c[3][axis] - c[0][axis]) * i) / 3),
          ),
        ),
      ),
    ) as Vec3;
    if (Math.max(...error) <= tolerance || depth >= 12) {
      result.push({
        id: id + suffix,
        start: timeRange[0],
        end: timeRange[1],
        a: c[0],
        b: c[3],
        padding: padding.map((v, i) => v + error[i]) as Vec3,
      });
      return;
    }
    const a = mid(c[0], c[1]),
      b = mid(c[1], c[2]),
      d = mid(c[2], c[3]),
      e = mid(a, b),
      f = mid(b, d),
      g = mid(e, f);
    split([c[0], a, e, g], depth + 1, suffix + "L");
    split([g, f, d, c[3]], depth + 1, suffix + "R");
  }
  split(controls, 0, "");
  return result;
}
