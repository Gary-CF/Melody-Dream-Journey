import { segmentBox, type SpatialProxy, type Vec3 } from "./spatial";
import { observerCameraRadius } from "./observer-space";
export interface ViewGeometry {
  position: Vec3;
  target: Vec3;
}
export interface ViewIssue {
  code: "camera-inside-solid" | "focus-occluded";
  instanceId: string;
  proxyId: string;
  point: Vec3;
}
/** Explicitly identified focal geometry is not an unrelated occluder.
 * Visibility is diagnostic, separate from physical camera clearance.
 */
export function inspectView(
  view: ViewGeometry,
  proxies: readonly SpatialProxy[],
  bodyRadius = observerCameraRadius,
  inspectFocus = true,
  focusContext: { viewId?: string; subjectIds?: readonly string[] } = {},
): ViewIssue[] {
  const result: ViewIssue[] = [];
  for (const p of proxies) {
    if (p.role === "decoration") continue;
    if (
      segmentBox(view.position, view.position, p.bounds, [
        bodyRadius,
        bodyRadius,
        bodyRadius,
      ]) !== undefined
    ) {
      result.push({
        code: "camera-inside-solid",
        instanceId: p.instanceId,
        proxyId: p.id,
        point: [...view.position],
      });
      continue;
    }
    if (
      !inspectFocus ||
      (p.subjectId && focusContext.subjectIds?.includes(p.subjectId)) ||
      (focusContext.viewId && p.hiddenInViews?.includes(focusContext.viewId))
    )
      continue;
    const u = segmentBox(view.position, view.target, p.bounds);
    if (u !== undefined && u < 1 - 1e-6)
      result.push({
        code: "focus-occluded",
        instanceId: p.instanceId,
        proxyId: p.id,
        point: view.position.map(
          (v, i) => v + (view.target[i] - v) * u,
        ) as Vec3,
      });
  }
  return result;
}
export interface CameraResolution {
  position: Vec3;
  adjusted: boolean;
  unresolved: ViewIssue[];
}
/** Continuous height envelope over projected obstacles. A six-metre smooth
 * approach raises the overhead camera before entering a collider projection.
 * Azimuth/target remain unchanged. First-person never uses this displacement.
 * This guarantees body clearance, not an unobstructed artistic focus.
 */
export function clearOverhead(
  view: ViewGeometry,
  proxies: readonly SpatialProxy[],
  radius = observerCameraRadius,
): CameraResolution {
  let position: Vec3 = [...view.position];
  for (const p of proxies) {
    if (
      p.role === "decoration" ||
      p.bounds.max[1] + radius + 0.05 < view.position[1]
    )
      continue;
    const dx = Math.max(
      p.bounds.min[0] - radius - position[0],
      0,
      position[0] - p.bounds.max[0] - radius,
    );
    const dz = Math.max(
      p.bounds.min[2] - radius - position[2],
      0,
      position[2] - p.bounds.max[2] - radius,
    );
    const distance = Math.hypot(dx, dz);
    if (distance >= 6) continue;
    const u = 1 - distance / 6,
      weight = u * u * (3 - 2 * u);
    const lift = (p.bounds.max[1] + radius + 0.05 - view.position[1]) * weight;
    position[1] = Math.max(position[1], view.position[1] + lift);
  }
  return {
    position,
    adjusted: position[1] > view.position[1] + 1e-8,
    unresolved: inspectView({ ...view, position }, proxies, radius, false),
  };
}
