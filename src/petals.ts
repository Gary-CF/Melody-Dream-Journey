import * as T from "three";
export class Petals {
  mesh: T.InstancedMesh;
  constructor(root: T.Group) {
    const shape = new T.Shape();
    shape.moveTo(0, -0.55);
    shape.bezierCurveTo(-0.6, -0.1, -0.55, 0.4, 0, 0.6);
    shape.bezierCurveTo(0.55, 0.4, 0.6, -0.1, 0, -0.55);
    this.mesh = new T.InstancedMesh(
      new T.ShapeGeometry(shape),
      new T.MeshStandardMaterial({
        color: "#ffc3d5",
        emissive: "#a34c75",
        emissiveIntensity: 0.3,
        side: T.DoubleSide,
        roughness: 0.75,
        transparent: true,
        opacity: 0.8,
      }),
      140,
    );
    this.mesh.frustumCulled = false;
    root.add(this.mesh);
  }
  update(time: number, anchor: T.Vector3 | undefined, gold = false) {
    this.mesh.visible = !!anchor;
    if (!anchor) return;
    const m = new T.Object3D();
    (this.mesh.material as T.MeshStandardMaterial).color.set(
      gold ? "#f5d478" : "#ffc3d5",
    );
    for (let i = 0; i < 140; i++) {
      const phase = (i * 0.61803398875) % 1;
      m.position.set(
        anchor.x + Math.sin(i * 2.4) * 18 + Math.sin(time * 0.28 + i) * 3,
        1 + ((((phase * 17 - time * (0.3 + phase * 0.3)) % 17) + 17) % 17),
        anchor.z + Math.cos(i * 2.4) * 18 + Math.cos(time * 0.19 + i) * 2,
      );
      m.rotation.set(time * 0.35 + i, time * 0.21 + i * 2, i + time * 0.3);
      m.scale.setScalar(0.13 + (i % 5) * 0.035);
      m.updateMatrix();
      this.mesh.setMatrixAt(i, m.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as T.Material).dispose();
  }
}
