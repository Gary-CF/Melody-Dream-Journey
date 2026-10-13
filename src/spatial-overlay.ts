import * as T from "three";
import type { Bounds3, Sweep, Vec3 } from "./domain/spatial";

/** Developer-only geometry. Owns its buffers/materials, never kit resources. */
export class SpatialOverlay {
  readonly group = new T.Group();
  constructor(
    reservations: readonly Sweep[],
    point?: Vec3,
    selected?: Bounds3,
  ) {
    this.group.name = "spatial-review-overlay";
    const lines: number[] = [];
    const box = (b: Bounds3, target: number[]) => {
      const points = Array.from({ length: 8 }, (_, i) => [
        i & 1 ? b.max[0] : b.min[0],
        i & 2 ? b.max[1] : b.min[1],
        i & 4 ? b.max[2] : b.min[2],
      ]);
      for (let i = 0; i < 8; i++)
        for (const mask of [1, 2, 4])
          if (!(i & mask)) target.push(...points[i], ...points[i | mask]);
    };
    for (const s of reservations)
      box(
        {
          min: s.a.map((v, i) => Math.min(v, s.b[i]) - s.padding[i]) as Vec3,
          max: s.a.map((v, i) => Math.max(v, s.b[i]) + s.padding[i]) as Vec3,
        },
        lines,
      );
    const add = (vertices: number[], color: string) => {
      if (!vertices.length) return;
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        "position",
        new T.Float32BufferAttribute(vertices, 3),
      );
      const material = new T.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        depthTest: false,
      });
      const object = new T.LineSegments(geometry, material);
      object.renderOrder = 100;
      this.group.add(object);
    };
    add(lines, "#70f1c0");
    const marker: number[] = [];
    if (point)
      for (let axis = 0; axis < 3; axis++) {
        const a = [...point],
          b = [...point];
        a[axis] -= 1.2;
        b[axis] += 1.2;
        marker.push(...a, ...b);
      }
    if (selected) box(selected, marker);
    add(marker, "#ff8269");
  }
  dispose() {
    this.group.traverse((o) => {
      if (o instanceof T.LineSegments) {
        o.geometry.dispose();
        (o.material as T.Material).dispose();
      }
    });
    this.group.removeFromParent();
  }
}
