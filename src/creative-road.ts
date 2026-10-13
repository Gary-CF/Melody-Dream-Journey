import * as T from "three";
import type { Kit } from "./assets";
import type { SceneRecipe } from "./domain/creative-library";
import { physical } from "./spatial-adapter";
import { rng } from "./model";

/** Road surfaces are interchangeable data-driven builders on the same safe route datum. */
export function buildCreativeRoad(
  k: Kit,
  root: T.Group,
  options: {
    length: number;
    width: number;
    road: SceneRecipe["road"];
    waterfront: boolean;
    seed: number;
    budget: number;
  },
) {
  const { length, width, road, waterfront } = options,
    r = rng(options.seed);
  const palette = {
    paving: ["#a9aead", "#b6bab4", "#c3c2b4"],
    stone: ["#74868b", "#8d9c9d", "#a3aeaa"],
    earth: ["#95816c", "#a68e70", "#b69d7f"],
    timber: ["#9b6958", "#b37d65", "#be8e72"],
  }[road];
  const support = (mesh: T.Mesh) => physical(mesh, "support");
  support(
    k.box(root, palette[0], 0, 0.035, length / 2, width, 0.27, length + width),
  );
  if (road === "paving" || road === "stone") {
    const columns = road === "stone" ? 4 : 2,
      cellWidth = width / columns;
    const step = Math.max(
      road === "stone" ? 1.1 : 1.8,
      length / Math.max(1, options.budget / columns),
    );
    for (let z = step / 2; z < length; z += step)
      for (let i = 0; i < columns; i++) {
        const x = -width / 2 + cellWidth * (i + 0.5),
          uneven = road === "stone" ? 0.025 : 0;
        const tile = k.box(
          root,
          palette[Math.floor(r() * palette.length)],
          x,
          0.185 + r() * uneven,
          z,
          cellWidth - 0.035,
          0.06,
          step - 0.04,
        );
        support(tile);
      }
  } else if (road === "timber") {
    const step = Math.max(0.6, length / Math.max(1, options.budget));
    for (let z = step / 2; z < length; z += step) {
      const plank = k.box(
        root,
        palette[Math.floor(r() * palette.length)],
        0,
        0.185,
        z,
        width + 0.04,
        0.075,
        step - 0.055,
      );
      support(plank);
    }
    for (const side of [-1, 1])
      support(
        k.box(
          root,
          "#694d49",
          side * (width / 2 - 0.25),
          -0.1,
          length / 2,
          0.22,
          0.28,
          length + width,
        ),
      );
  } else {
    // Continuous faceted soil ribbon with irregular edges, not repeated circular pads.
    const steps = Math.max(
        2,
        Math.min(80, Math.floor(options.budget / 2), Math.ceil(length / 2.2)),
      ),
      positions: number[] = [],
      colors: number[] = [];
    const edges = Array.from({ length: steps + 1 }, (_, i) => ({
      z: -width / 2 + (i / steps) * (length + width),
      left: -width / 2 - 0.12 - r() * 0.32,
      right: width / 2 + 0.12 + r() * 0.32,
    }));
    for (let i = 0; i < steps; i++) {
      const a = edges[i],
        b = edges[i + 1];
      for (const triangle of [
        [a.left, a.z, b.left, b.z, a.right, a.z],
        [a.right, a.z, b.left, b.z, b.right, b.z],
      ]) {
        const color = new T.Color(palette[1]).multiplyScalar(0.95 + r() * 0.1);
        for (let j = 0; j < 3; j++) {
          positions.push(triangle[j * 2], 0.18, triangle[j * 2 + 1]);
          colors.push(color.r, color.g, color.b);
        }
      }
      if (i % 3 === 0)
        for (const side of [-1, 1]) {
          const stone = k.mesh(
            root,
            "ball",
            "#8e9791",
            side * (width / 2 + 0.4 + r() * 0.3),
            0.09,
            a.z,
            0.12 + r() * 0.16,
            0.1,
            0.15 + r() * 0.1,
          );
          support(stone);
        }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const surface = new T.Mesh(
      geometry,
      new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        side: T.DoubleSide,
      }),
    );
    surface.receiveShadow = true;
    support(surface);
    root.add(surface);
    root.userData.extra = [...(root.userData.extra ?? []), surface];
  }

  if (road !== "earth")
    for (const side of [-1, 1]) {
      support(
        k.box(
          root,
          palette[0],
          side * (width / 2 + 0.065),
          0.16,
          length / 2,
          0.13,
          0.22,
          Math.max(0.1, length - width),
        ),
      );
    }
  if (waterfront) {
    for (const side of [-1, 1]) {
      k.box(
        root,
        "#755659",
        side * (width / 2 + 0.16),
        0.85,
        length / 2,
        0.095,
        0.09,
        Math.max(0.1, length - width),
      );
      for (let z = width / 2; z < length - width / 2; z += 3.8) {
        k.box(
          root,
          "#906766",
          side * (width / 2 + 0.16),
          0.54,
          z,
          0.12,
          0.82,
          0.12,
        );
        support(
          k.box(
            root,
            "#66525a",
            side * (width / 2 - 0.1),
            -0.8,
            z,
            0.32,
            1.6,
            0.32,
          ),
        );
      }
    }
  }
}
