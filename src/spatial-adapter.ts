import * as T from "three";
import type {
  Bounds3,
  PhysicalRole,
  SpatialProxy,
  Vec3,
} from "./domain/spatial";

/** Explicit metadata belongs to the factory; material/colour never imply physics. */
export function physical<TObject extends T.Object3D>(
  object: TObject,
  role: PhysicalRole,
): TObject {
  object.userData.physicalRole = role;
  return object;
}
export function spatialRole(
  object: T.Object3D,
  root: T.Object3D,
): PhysicalRole {
  let node: T.Object3D | null = object;
  while (node) {
    const role = node.userData.physicalRole;
    if (role === "solid" || role === "support" || role === "decoration")
      return role;
    if (node === root) break;
    node = node.parent;
  }
  return "solid";
}
function portable(box: T.Box3): Bounds3 {
  return { min: box.min.toArray(), max: box.max.toArray() };
}
export function spatialViewMetadata(object: T.Object3D, root: T.Object3D) {
  let node: T.Object3D | null = object,
    subjectId: string | undefined;
  const hidden = new Set<string>();
  while (node) {
    if (!subjectId && typeof node.userData.spatialSubjectId === "string")
      subjectId = node.userData.spatialSubjectId;
    // Legacy cutaway factories already name these physical objects; only their
    // overhead visibility changes. Their colliders always remain solid.
    if (node.name === "cutaway-roof" || node.name === "cutaway-wall")
      hidden.add("overhead");
    if (node === root) break;
    node = node.parent;
  }
  return { subjectId, hiddenInViews: [...hidden] };
}
/** Mesh-level compounds retain doorways and canopy height. World transforms are
 * applied once, before rendering batches merge objects by material. A torus is
 * triangle-bounded so its traversable centre does not become a solid box.
 */
export function collectProxies(
  root: T.Object3D,
  instanceId: string,
  motionPadding: Vec3 = [0, 0, 0],
): SpatialProxy[] {
  root.updateWorldMatrix(true, true);
  const result: SpatialProxy[] = [];
  let index = 0;
  root.traverse((o) => {
    if (!(o instanceof T.Mesh)) return;
    const role = spatialRole(o, root),
      meshId = `${instanceId}/mesh-${index++}`;
    if (role === "decoration") return;
    const boxes: T.Box3[] = [];
    if (o.geometry.type === "TorusGeometry") {
      const p = o.geometry.getAttribute("position"),
        ix = o.geometry.index;
      const count = ix?.count ?? p.count;
      for (let i = 0; i < count; i += 3) {
        const box = new T.Box3();
        for (let j = 0; j < 3; j++)
          box.expandByPoint(
            new T.Vector3().fromBufferAttribute(p, ix ? ix.getX(i + j) : i + j),
          );
        boxes.push(box);
      }
    } else {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (o.geometry.boundingBox) boxes.push(o.geometry.boundingBox.clone());
    }
    const matrices: T.Matrix4[] = [];
    if (o instanceof T.InstancedMesh)
      for (let i = 0; i < o.count; i++) {
        const m = new T.Matrix4();
        o.getMatrixAt(i, m);
        matrices.push(o.matrixWorld.clone().multiply(m));
      }
    else matrices.push(o.matrixWorld);
    matrices.forEach((m, instance) =>
      boxes.forEach((box, part) => {
        const world = box.clone().applyMatrix4(m);
        world.min.sub(new T.Vector3(...motionPadding));
        world.max.add(new T.Vector3(...motionPadding));
        result.push({
          id: `${meshId}/${instance}/${part}`,
          instanceId,
          role,
          bounds: portable(world),
          ...spatialViewMetadata(o, root),
        });
      }),
    );
  });
  return result;
}

/** Only candidate-owned allocations are disposed. Kit geometry/material pools
 * remain alive for accepted siblings; the Kit owns their final disposal. */
export function releaseCandidate(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>();
  root.traverse((o) => {
    for (const geometry of o.userData.mergedGeometries ?? [])
      geometries.add(geometry);
    for (const mesh of o.userData.extra ?? []) {
      if (mesh.geometry) geometries.add(mesh.geometry);
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        if (material) materials.add(material);
    }
    o.userData.mergedGeometries = [];
    o.userData.extra = [];
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  root.removeFromParent();
}
