import * as T from "three";
import type { SightSurface } from "./domain/visibility";
import type { Vec3 } from "./domain/spatial";
import { spatialRole, spatialViewMetadata } from "./spatial-adapter";
import { capabilitySurfaces } from "./capability-observation";

/** World-coordinate copies survive material batching; no live mesh or GPU resource is retained. */
export function collectSightSurfaces(
  root: T.Object3D,
  instanceId: string,
  motionPadding: Vec3 = [0, 0, 0],
): SightSurface[] {
  root.updateWorldMatrix(true, true);
  const surfaces: SightSurface[] = [];
  let index = 0;
  root.traverse((object) => {
    surfaces.push(...capabilitySurfaces(object, instanceId));
    if (!(object instanceof T.Mesh)) return;
    const id = `${instanceId}/mesh-${index++}`;
    if (spatialRole(object, root) === "decoration") return;
    const attribute = object.geometry.getAttribute("position"),
      ix = object.geometry.index;
    if (!attribute) return;
    const matrices: T.Matrix4[] = [];
    if (object instanceof T.InstancedMesh)
      for (let i = 0; i < object.count; i++) {
        const m = new T.Matrix4();
        object.getMatrixAt(i, m);
        matrices.push(object.matrixWorld.clone().multiply(m));
      }
    else matrices.push(object.matrixWorld);
    matrices.forEach((matrix, instance) => {
      const count = ix?.count ?? attribute.count,
        triangles = new Float32Array(count * 3),
        bounds = new T.Box3(),
        point = new T.Vector3();
      for (let i = 0; i < count; i++) {
        point
          .fromBufferAttribute(attribute, ix ? ix.getX(i) : i)
          .applyMatrix4(matrix);
        bounds.expandByPoint(point);
        triangles.set(point.toArray(), i * 3);
        // Broad-phase bounds must also contain the rounded vertices used by the narrow phase.
        bounds.expandByPoint(point.fromArray(triangles, i * 3));
      }
      bounds.min.sub(new T.Vector3(...motionPadding));
      bounds.max.add(new T.Vector3(...motionPadding));
      surfaces.push({
        id: `${id}/${instance}`,
        instanceId,
        bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
        triangles,
        dynamic: motionPadding.some((v) => v > 0),
        ...spatialViewMetadata(object, root),
      });
    });
  });
  return surfaces;
}
