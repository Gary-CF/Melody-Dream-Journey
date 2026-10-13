import type { Part } from "../design";
import type { ComponentRecipe } from "./creative-library";
import type { VisualEffect } from "./visual-effects";
type Point = [number, number, number];
/** Version 2: connected tapered limbs, asymmetric crown and colour variation.
 * This is bounded geometry, not a runtime script from the model. */
export function floweringTree(
  spec: Extract<ComponentRecipe, { generator: "branching-tree" }>,
) {
  const parts: Part[] = [],
    effects: VisualEffect[] = [];
  let seed = spec.seed >>> 0;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const h = spec.height,
    w = spec.spread;
  const tint = (hex: string, k: number) =>
    "#" +
    [1, 3, 5]
      .map((i) =>
        Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * k))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  const limb = (a: Point, b: Point, r: number) => {
    const d = b.map((n, i) => n - a[i]),
      length = Math.hypot(...d);
    parts.push({
      shape: "taper",
      position: a.map((n, i) => (n + b[i]) / 2) as Point,
      scale: [r, length, r],
      rotation: [Math.atan2(d[2], d[1]), 0, -Math.asin(d[0] / length)],
      color: spec.trunk,
    });
  };
  const base: Point = [0, 0, 0],
    fork: Point = [-h * 0.04, h * 0.3, h * 0.01],
    heart: Point = [h * 0.02, h * 0.55, -h * 0.03];
  limb(base, fork, h * 0.064);
  limb(fork, heart, h * 0.044);
  parts.push({
    shape: "ball",
    position: fork,
    scale: [h * 0.029, h * 0.035, h * 0.029],
    color: spec.trunk,
  });
  for (let i = 0; i < 7; i++) {
    const angle = (i * Math.PI * 2) / 7 + (random() - 0.5) * 0.35,
      reach = w * (0.55 + random() * 0.27);
    const a: Point = i % 2 ? [...fork] : [...heart];
    const elbow: Point = [
      Math.cos(angle) * reach * 0.56,
      h * (0.52 + random() * 0.17),
      Math.sin(angle) * reach * 0.56,
    ];
    const tip: Point = [
      Math.cos(angle) * reach,
      h * (0.72 + random() * 0.16),
      Math.sin(angle) * reach,
    ];
    limb(a, elbow, h * 0.028);
    limb(elbow, tip, h * 0.014);
    parts.push({
      shape: "ball",
      position: elbow,
      scale: [h * 0.012, h * 0.014, h * 0.012],
      color: spec.trunk,
    });
    for (let j = 0; j < 4; j++) {
      const bearing = angle + j * Math.PI * 0.53,
        r = w * (0.18 + random() * 0.065) * (0.72 + 0.28 * spec.bloom);
      parts.push({
        shape: "ball",
        position: [
          tip[0] + Math.cos(bearing) * r * 0.85,
          tip[1] + (random() - 0.35) * h * 0.11,
          tip[2] + Math.sin(bearing) * r * 0.8,
        ],
        scale: [r, r * (0.66 + random() * 0.2), r * 0.86],
        rotation: [0, random(), 0],
        color: tint(spec.foliage, 0.92 + random() * 0.16),
      });
    }
  }
  for (let i = 0; i < 5; i++) {
    const angle = (i * Math.PI * 2) / 5;
    limb(
      [0, 0.3, 0],
      [Math.cos(angle) * h * 0.12, 0.03, Math.sin(angle) * h * 0.12],
      h * 0.025,
    );
  }
  parts.push({
    shape: "ball",
    position: [h * 0.01, h * 0.84, -h * 0.02],
    scale: [w * 0.3, h * 0.17, w * 0.26],
    color: tint(spec.foliage, 1.03),
  });
  if (spec.fallingPetals)
    effects.push({
      kind: "falling-petals",
      position: [0, h * 0.49, 0],
      extent: [w * 2, h, w * 1.6],
      color: spec.foliage,
      rate: 0.3,
      seed: spec.seed,
    });
  return { parts, effects };
}
