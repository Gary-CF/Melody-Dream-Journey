import * as T from "three";
import {
  validateVisualEffects,
  type VisualEffect,
} from "./domain/visual-effects";
import { physical } from "./spatial-adapter";
import { rng } from "./model";
import { creativeWaterMaterial } from "./creative-water-material";

interface LiveEffect {
  owner: T.Object3D;
  spec: VisualEffect;
  mesh: T.Mesh;
  seeds?: Float32Array;
}
/** Asset-local effects follow the same assembly in every camera. Playback uses
 * absolute song time, so a seek/replay never accumulates simulation drift. */
export class CreativeEffects {
  private entries: LiveEffect[] = [];
  private transform = new T.Object3D();
  private position = new T.Vector3();
  private daylight = new T.Color(1, 1, 1);
  constructor(root: T.Object3D) {
    try {
      const pending: { owner: T.Object3D; spec: VisualEffect }[] = [];
      root.traverse((owner) => {
        if (owner.userData.visualEffects)
          for (const spec of validateVisualEffects(
            owner.userData.visualEffects,
          ))
            pending.push({ owner, spec });
      });
      const petals = pending.filter(
        (e) => e.spec.kind === "falling-petals",
      ).length;
      if (pending.length > 64 || petals * 96 > 4096)
        throw Error("动态组件超出单场景效果预算");
      for (const { owner, spec } of pending) {
        const mesh =
          spec.kind === "falling-petals" ? this.petals(spec) : this.water(spec);
        mesh.position.fromArray(spec.position);
        mesh.frustumCulled = false;
        physical(mesh, "decoration");
        owner.add(mesh);
        const random = rng(spec.seed),
          seeds =
            spec.kind === "falling-petals"
              ? Float32Array.from({ length: 96 * 4 }, () => random())
              : undefined;
        this.entries.push({ owner, spec, mesh, seeds });
      }
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  private water(spec: VisualEffect) {
    const material = creativeWaterMaterial(spec);
    return new T.Mesh(
      new T.PlaneGeometry(spec.extent[0], spec.extent[1], 1, 1),
      material,
    );
  }
  private petals(spec: VisualEffect) {
    const shape = new T.Shape();
    shape.moveTo(0, -0.55);
    shape.bezierCurveTo(-0.48, -0.1, -0.45, 0.36, 0, 0.6);
    shape.bezierCurveTo(0.45, 0.36, 0.48, -0.1, 0, -0.55);
    const material = new T.MeshStandardMaterial({
      color: spec.color,
      emissive: spec.color,
      emissiveIntensity: 0.12,
      roughness: 0.8,
      side: T.DoubleSide,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
    return new T.InstancedMesh(new T.ShapeGeometry(shape, 5), material, 96);
  }
  update(time: number, observer: T.Vector3, illumination?: T.Color) {
    for (const { owner, spec, mesh, seeds } of this.entries) {
      owner.getWorldPosition(this.position);
      mesh.visible = this.position.distanceTo(observer) < 170;
      if (!mesh.visible) continue;
      if (spec.kind !== "falling-petals") {
        const uniforms = (mesh.material as T.ShaderMaterial).uniforms;
        uniforms.uTime.value = time * spec.rate;
        uniforms.uIllumination.value.copy(illumination ?? this.daylight);
      } else {
        const instance = mesh as T.InstancedMesh,
          transform = this.transform;
        for (let i = 0; i < instance.count; i++) {
          const a = seeds![i * 4],
            b = seeds![i * 4 + 1],
            c = seeds![i * 4 + 2],
            d = seeds![i * 4 + 3];
          const phase =
            (((b - (time * spec.rate) / spec.extent[1]) % 1) + 1) % 1;
          transform.position.set(
            (a - 0.5) * spec.extent[0] + Math.sin(time * 0.28 + b * 15) * 0.7,
            (phase - 0.5) * spec.extent[1],
            (c - 0.5) * spec.extent[2] + Math.cos(time * 0.23 + d * 15) * 0.6,
          );
          transform.rotation.set(
            time * 0.25 + a * 8,
            time * 0.38 + b * 8,
            time * 0.18 + c * 8,
          );
          transform.scale.setScalar(0.12 + d * 0.13);
          transform.updateMatrix();
          instance.setMatrixAt(i, transform.matrix);
        }
        instance.instanceMatrix.needsUpdate = true;
      }
    }
  }
  dispose() {
    for (const { mesh } of this.entries) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      for (const material of Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material])
        material.dispose();
      if (mesh instanceof T.InstancedMesh) mesh.dispose();
    }
    this.entries = [];
  }
}
