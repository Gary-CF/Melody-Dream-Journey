import type { Part } from "../design";
import type { ComponentRecipe } from "./creative-library";
import type { VisualEffect } from "./visual-effects";

/** Revision 2: an asymmetric continuous cliff, with shelves rather than stacked boxes.
 * Old serialized recipes keep revision 1 geometry. */
export function naturalCascade(
  spec: Extract<ComponentRecipe, { generator: "cascade" }>,
) {
  const parts: Part[] = [],
    effects: VisualEffect[] = [];
  let seed = spec.seed >>> 0;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const h = spec.height,
    w = spec.width,
    step = h / spec.tiers;
  const tint = (hex: string, amount: number) =>
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.min(
          255,
          Math.max(0, Math.round(parseInt(hex.slice(i, i + 2), 16) * amount)),
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  // Tall offset shoulders give the waterfall a landform silhouette and a dark recess.
  for (const side of [-1, 1]) {
    const reach = h * (side === -1 ? 0.99 : 0.87);
    parts.push({
      shape: "ball",
      position: [side * w * 0.47, reach * 0.48, -3.3],
      scale: [w * (0.48 + random() * 0.06), reach * 0.57, 4.7],
      rotation: [0.04, side * 0.14, side * 0.08],
      color: tint(spec.rock, side === -1 ? 0.82 : 0.96),
    });
  }
  for (let tier = 0; tier < spec.tiers; tier++) {
    const y = tier * step,
      z = -tier * 1.15,
      x = Math.sin(tier * 1.6 + (spec.seed % 7)) * w * 0.13;
    const streamWidth = w * (0.38 + (spec.tiers - tier) * 0.07);
    parts.push({
      shape: "ball",
      position: [x, y + step * 0.47, z - 1.9],
      scale: [w * 0.58, step * 0.72, 2.15],
      color: tint(spec.rock, 0.83 + tier * 0.035),
    });
    for (const side of [-1, 1]) {
      const edgeX = x + side * (streamWidth * 0.53 + w * 0.16);
      parts.push({
        shape: "ball",
        position: [edgeX, y + step * 0.51, z - 0.42],
        scale: [
          w * (0.2 + random() * 0.08),
          step * (0.52 + random() * 0.1),
          1.6,
        ],
        rotation: [random() * 0.2, random() * 0.4, side * 0.14],
        color: tint(spec.rock, 0.94 + random() * 0.16),
      });
      parts.push({
        shape: "ball",
        position: [edgeX, y + step * 0.9, z - 0.5],
        scale: [w * 0.23, 0.28 + random() * 0.18, 1.6],
        color: tint(spec.moss, 0.9 + random() * 0.18),
      });
    }
    // Broad irregular rock lip hides the geometric meeting point between falling sheets.
    parts.push({
      shape: "ball",
      position: [x - w * 0.07, y + 0.1, z + 0.36],
      scale: [w * 0.71, 0.29, 2.4],
      color: tint(spec.rock, 1.13),
    });
    parts.push({
      shape: "ball",
      position: [x, y + 0.36, z + 0.48],
      scale: [streamWidth * 0.72, 0.045, 1.75],
      color: spec.water,
    });
    effects.push({
      kind: "falling-water",
      position: [x, y + step * 0.52, z + 0.33],
      extent: [streamWidth, step * 1.04, 0.3],
      color: spec.water,
      rate: 1 + tier * 0.07,
      seed: (spec.seed + tier) >>> 0,
    });
  }
  parts.push({
    shape: "ball",
    position: [0, 0.06, 3.4],
    scale: [w * 0.87, 0.09, 4.8],
    color: spec.water,
  });
  // A broken shoreline leaves the viewing side open instead of forming a circular fountain rim.
  for (let i = 0; i < 9; i++) {
    const angle = (i / 8) * Math.PI * 1.28 + Math.PI * 0.36;
    parts.push({
      shape: "ball",
      position: [Math.cos(angle) * w * 0.87, 0.12, 3.1 + Math.sin(angle) * 4.3],
      scale: [
        w * (0.13 + random() * 0.06),
        0.35 + random() * 0.4,
        0.7 + random(),
      ],
      rotation: [0, random(), random() * 0.16],
      color: tint(spec.rock, 1.05 + random() * 0.1),
    });
  }
  effects.push({
    kind: "water-mist",
    position: [0, 1.0, 2.3],
    extent: [w * 1.1, 2.8, 0.3],
    color: spec.water,
    rate: 0.3,
    seed: spec.seed,
  });
  return { parts, effects };
}
