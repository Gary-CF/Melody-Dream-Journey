import * as T from "three";
import type { VisualEffect } from "./domain/visual-effects";
import type { SightSurface } from "./domain/visibility";

/** Factory-declared feature regions, independent of model prose. A water sheet
 * has a fixed world surface although its shader flows with the music clock. */
export function bindCapabilityObservation(
  owner: T.Object3D,
  capability: string,
  subjectId: string,
): boolean {
  const effects = owner.userData.visualEffects as VisualEffect[] | undefined;
  let present =
    capability === "falling-water" &&
    !!effects?.some((e) => e.kind === capability);
  owner.traverse((part) => {
    if (part.userData.visualFeature === capability) present = true;
  });
  if (!present) return false;
  owner.userData.capabilitySubjects ??= {};
  owner.userData.capabilitySubjects[capability] = subjectId;
  return true;
}

/** Region centers come from actual factory geometry/effects, never model coordinates. */
export function capabilityCenter(
  owner: T.Object3D,
  capability: string,
): T.Vector3 | undefined {
  const surfaces = capabilitySurfaces(owner, "focus").filter(
    (s) => s.subjectId === owner.userData.capabilitySubjects?.[capability],
  );
  if (!surfaces.length) return;
  const bounds = new T.Box3();
  for (const s of surfaces)
    bounds.union(
      new T.Box3(
        new T.Vector3(...s.bounds.min),
        new T.Vector3(...s.bounds.max),
      ),
    );
  return bounds.getCenter(new T.Vector3());
}

export function capabilitySurfaces(
  owner: T.Object3D,
  instanceId: string,
): SightSurface[] {
  const bindings = owner.userData.capabilitySubjects as
    | Record<string, string>
    | undefined;
  if (!bindings) return [];
  const effects = (owner.userData.visualEffects ?? []) as VisualEffect[];
  const regions: SightSurface[] = [];
  owner.traverse((part) => {
    const subjectId = bindings[part.userData.visualFeature];
    if (!subjectId || !(part instanceof T.Mesh)) return;
    const position = part.geometry.getAttribute("position"),
      index = part.geometry.index;
    const values: number[] = [],
      bounds = new T.Box3();
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const points = [0, 1, 2].map((offset) =>
        new T.Vector3()
          .fromBufferAttribute(
            position,
            index ? index.getX(i + offset) : i + offset,
          )
          .applyMatrix4(part.matrixWorld),
      );
      // A shallow pool is observed on its upper surface, not its buried underside.
      if (
        part.userData.visualFeature === "water-pool" &&
        points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]))
          .y <= 0
      )
        continue;
      points.forEach((point) => {
        values.push(...point.toArray());
        bounds.expandByPoint(point);
      });
    }
    if (values.length)
      regions.push({
        id: `${instanceId}/${subjectId}/region-${regions.length}`,
        instanceId,
        subjectId,
        bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
        triangles: new Float32Array(values),
        hiddenInViews: [],
        dynamic: false,
        observationOnly: true,
      });
  });
  return [
    ...regions,
    ...effects.flatMap((effect, index) => {
      const subjectId = bindings[effect.kind];
      if (!subjectId || effect.kind !== "falling-water") return [];
      const [x, y, z] = effect.position,
        [width, height] = effect.extent;
      // This is the rendered plane itself, not the enclosing cliff's silhouette.
      const local = [
        [x - width / 2, y - height / 2, z],
        [x + width / 2, y - height / 2, z],
        [x + width / 2, y + height / 2, z],
        [x - width / 2, y - height / 2, z],
        [x + width / 2, y + height / 2, z],
        [x - width / 2, y + height / 2, z],
      ];
      const triangles = new Float32Array(18),
        bounds = new T.Box3();
      local.forEach((p, i) => {
        const point = new T.Vector3(...p).applyMatrix4(owner.matrixWorld);
        triangles.set(point.toArray(), i * 3);
        bounds.expandByPoint(point.fromArray(triangles, i * 3));
      });
      return [
        {
          id: `${instanceId}/${subjectId}/feature-${index}`,
          instanceId,
          subjectId,
          bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
          triangles,
          hiddenInViews: [],
          dynamic: false,
          observationOnly: true,
        },
      ];
    }),
  ];
}
