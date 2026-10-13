import type { Part } from "../design";
import type { ComponentRecipe } from "./creative-library";
import type { VisualEffect } from "./visual-effects";

/** Revision 3 keeps every shelf supported by the cliff below it. Unequal
 * setbacks make a continuous ravine instead of a stack of detached basins. */
export function cliffCascade(
  spec: Extract<ComponentRecipe, { generator: "cascade" }>,
) {
  const parts: Part[] = [],
    effects: VisualEffect[] = [];
  let seed = spec.seed >>> 0;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
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
  const h = spec.height,
    w = spec.width,
    step = h / spec.tiers;
  // Revision 4 exposes the promised stream: v3's full-height shoulders and
  // support fronts could cover every water sheet while the cliff passed framing.
  const exposed = spec.revision === 4;
  parts.push({
    shape: "rock",
    position: [0, h * 0.5, -(spec.tiers - 1) * 0.9 - 1.8],
    scale: [w * 0.39, h * 0.64, 1.8],
    color: tint(spec.rock, 0.79),
  });
  // Continuous rock shoulders are rooted at ground level, including upper tiers.
  for (const side of [-1, 1]) {
    for (let slab = 0; slab < 3; slab++) {
      const reach = h * (0.8 + random() * 0.22),
        x = side * w * ((exposed ? 0.6 : 0.37) + slab * 0.15);
      parts.push({
        shape: "rock",
        position: [x, reach * 0.42, -2.6 - slab * 0.35],
        scale: [
          w * ((exposed ? 0.22 : 0.32) + random() * (exposed ? 0.04 : 0.08)),
          reach * 0.65,
          3.8 + random(),
        ],
        rotation: [0, side * 0.18, side * (0.04 + random() * 0.06)],
        color: tint(spec.rock, 0.7 + slab * 0.13),
      });
    }
  }
  for (let tier = 0; tier < spec.tiers; tier++) {
    const y = tier * step,
      z = -tier * 0.9,
      x = Math.sin(tier * 1.3 + (spec.seed % 11)) * w * 0.08;
    const streamWidth = w * (0.31 + (spec.tiers - tier) * 0.055);
    // Lower support extends through the entire height, so no hover-shaped ledges.
    parts.push({
      shape: "rock",
      position: [x, (y + step) * 0.38, z - (exposed ? 1.9 : 1.3)],
      scale: [w * 0.5, (y + step) * 0.66, exposed ? 1.9 : 2.3],
      color: tint(spec.rock, 0.78 + tier * 0.06),
    });
    for (const side of [-1, 1]) {
      const px = x + side * (streamWidth * 0.62 + w * 0.12);
      parts.push({
        shape: "rock",
        position: [px, y + step * 0.48, z - 0.6],
        scale: [w * 0.23, step * 0.72, 1.65],
        rotation: [0.02, side * 0.24, side * 0.1],
        color: tint(spec.rock, 0.91 + random() * 0.15),
      });
      parts.push({
        shape: "rock",
        position: [px + side * w * 0.045, y + step * 0.85, z - 0.8],
        scale: [w * 0.2, 0.17, 1.1],
        color: tint(spec.moss, 0.82 + random() * 0.25),
      });
    }
    parts.push({
      shape: "rock",
      position: [x, y + 0.14, z - 0.1],
      scale: [w * 0.45, 0.36, 1.2],
      color: tint(spec.rock, 1.11),
    });
    effects.push({
      kind: "falling-water",
      position: [x, y + step * 0.5, z + 0.32],
      extent: [streamWidth, step, 0.3],
      color: spec.water,
      rate: 0.85 + tier * 0.09,
      seed: (spec.seed + tier) >>> 0,
    });
  }
  // One shallow receiving pool rather than a water disc at every level.
  parts.push({
    ...(exposed ? { feature: "water-pool" } : {}),
    shape: "ball",
    position: [w * 0.07, 0.035, 2.8],
    scale: [w * 0.62, 0.065, 3.6],
    color: spec.water,
  });
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI * 0.18 + (i / 9) * Math.PI * 1.55;
    parts.push({
      shape: "rock",
      position: [
        Math.cos(angle) * w * 0.64,
        0.12,
        2.8 + Math.sin(angle) * 3.25,
      ],
      scale: [
        w * (0.07 + random() * 0.11),
        0.24 + random() * 0.55,
        0.5 + random() * 0.7,
      ],
      rotation: [0, random() * 2, 0],
      color: tint(spec.rock, 0.94 + random() * 0.23),
    });
  }
  effects.push({
    kind: "water-mist",
    position: [0, 0.8, 1.8],
    extent: [w * 0.85, 2.2, 0.3],
    color: spec.water,
    rate: 0.25,
    seed: spec.seed,
  });
  return { parts, effects };
}
