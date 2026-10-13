import * as T from "three";
import type { Vec3 } from "./domain/spatial";
export interface AssemblyPart {
  id: string;
  root: T.Object3D;
  /** Minimum surface clearance in metres; each pair honors the larger request. */
  minimumGap: number;
  /** Opt-in independent focal object. Attached structures have no such role. */
  role?: "primary" | "supporting";
  /** Interlocking landforms may overlap; independent buildings may not. */
  interlocking?: boolean;
}
const authoredParts = new WeakMap<T.Object3D, readonly AssemblyPart[]>();
export function declareAssemblyParts(
  owner: T.Object3D,
  parts: readonly AssemblyPart[],
) {
  authoredParts.set(owner, parts);
}
export function assemblyParts(owner: T.Object3D): readonly AssemblyPart[] {
  return authoredParts.get(owner) ?? [];
}

/** Construction-only clearance between factory-declared independent parts. */
export function assemblyPartsOverlap(parts: readonly AssemblyPart[]): boolean {
  const boxes = parts.map((part) => new T.Box3().setFromObject(part.root));
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      if (parts[i].interlocking && parts[j].interlocking) continue;
      const halfGap = Math.max(parts[i].minimumGap, parts[j].minimumGap) / 2;
      if (
        boxes[i]
          .clone()
          .expandByScalar(halfGap)
          .intersectsBox(boxes[j].clone().expandByScalar(halfGap))
      )
        return true;
    }
  return false;
}

/** An assembly and its world anchors move as one unit before rendering batches
 * are frozen. Camera/route policy remains outside this renderer adapter. */
export interface SceneAssembly {
  placementId: string;
  root: T.Object3D;
  anchors: { local: Vec3; world: T.Vector3; owner?: T.Object3D }[];
  /** Independently placed subjects, explicitly opted in by the assembly author.
   * Connected structures never enter this list. Mesh scale is immutable. */
  parts?: readonly AssemblyPart[];
  facing?: readonly FacingConstraint[];
}
export interface FacingConstraint {
  root: T.Object3D;
  localYaw: number;
  target: Vec3;
}
/** Construction only: a front-facing subject keeps facing its observation point
 * after a legal placement move. All physical/visibility checks follow this step. */
export function updateAssemblyFacing(
  constraints: readonly FacingConstraint[] = [],
) {
  for (const constraint of constraints) {
    const part = constraint.root;
    part.parent?.updateWorldMatrix(true, false);
    const target = new T.Vector3(...constraint.target);
    part.parent?.worldToLocal(target);
    part.rotation.y =
      Math.atan2(target.x - part.position.x, target.z - part.position.z) -
      constraint.localYaw;
    part.updateWorldMatrix(false, true);
  }
}
export function updateAssemblyAnchors(assembly: SceneAssembly) {
  assembly.root.updateWorldMatrix(true, true);
  for (const anchor of assembly.anchors)
    anchor.world.copy(
      (anchor.owner ?? assembly.root).localToWorld(
        new T.Vector3(...anchor.local),
      ),
    );
}
