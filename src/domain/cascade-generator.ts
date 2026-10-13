import { naturalCascade } from "./natural-cascade";
import { cliffCascade } from "./cliff-cascade";
import type { Part } from "../design";
import type { ComponentRecipe } from "./creative-library";
import type { VisualEffect } from "./visual-effects";

/** A bounded multi-tier landform, reusable for mountain streams or dreamlike falls. */
export function generateCascade(
  spec: Extract<ComponentRecipe, { generator: "cascade" }>,
) {
  if (spec.revision === 3 || spec.revision === 4) return cliffCascade(spec);
  if (spec.revision === 2) return naturalCascade(spec);
  const parts: Part[] = [],
    effects: VisualEffect[] = [];
  let seed = spec.seed >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const h = spec.height / spec.tiers,
    w = spec.width;
  for (let tier = 0; tier < spec.tiers; tier++) {
    const y = tier * h,
      z = -tier * 1.4,
      offset = (random() - 0.5) * w * 0.2;
    parts.push({
      shape: "box",
      position: [offset, y + h * 0.48, z - 1.9],
      scale: [w * 1.1, h * 0.96, 3.8],
      color: spec.rock,
    });
    for (const side of [-1, 1]) {
      parts.push({
        shape: "ball",
        position: [offset + side * w * 0.52, y + h * 0.45, z - 0.4],
        scale: [w * 0.3, h * (0.54 + random() * 0.08), 2.5],
        color: spec.rock,
      });
      parts.push({
        shape: "ball",
        position: [offset + side * w * 0.55, y + h * 0.85, z],
        scale: [w * 0.25, 0.45, 1.4],
        color: spec.moss,
      });
    }
    parts.push({
      shape: "box",
      position: [offset, y + 0.18, z + 0.2],
      scale: [w * 1.25, 0.3, 2.8],
      color: spec.rock,
    });
    parts.push({
      shape: "box",
      position: [offset, y + 0.35, z + 0.35],
      scale: [w * 0.85, 0.04, 2.2],
      color: spec.water,
    });
    effects.push({
      kind: "falling-water",
      position: [offset, y + h * 0.5, z + 0.04],
      extent: [w * 0.64, h, 0.3],
      color: spec.water,
      rate: 0.8 + tier * 0.12,
      seed: (spec.seed + tier) >>> 0,
    });
  }
  parts.push({
    shape: "cylinder",
    position: [0, 0.12, 2],
    scale: [w * 0.8, 0.18, 3.5],
    color: spec.water,
  });
  return { parts, effects };
}
