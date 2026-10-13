import { generateColonnade } from "./colonnade-generator";
import { validateRecipes, type Recipe, type Part } from "../design";
import type { LibraryEntry } from "./creative-library";
import type { VisualEffect } from "./visual-effects";
import { generateCascade } from "./cascade-generator";
import { floweringTree } from "./flowering-tree";

/** Pure bounded geometry recipes; renderer ownership and spatial validation stay downstream. */
export function generateComponent(entry: LibraryEntry): Recipe | undefined {
  if (entry.layer !== "component") throw Error("组件生成器收到其他层级");
  const spec = entry.recipe;
  if (spec.generator === "existing") return undefined;
  let parts: Part[] = [];
  let effects: VisualEffect[] | undefined;
  if (spec.generator === "assembly") parts = structuredClone(spec.parts);
  else if (spec.generator === "colonnade") parts = generateColonnade(spec);
  else if (spec.generator === "cascade")
    ({ parts, effects } = generateCascade(spec));
  else if (spec.revision === 2) ({ parts, effects } = floweringTree(spec));
  else {
    let seed = spec.seed >>> 0;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const branch = (
      a: [number, number, number],
      b: [number, number, number],
      radius: number,
    ) => {
      const delta = b.map((v, i) => v - a[i]),
        length = Math.hypot(...delta);
      // Cylinder Y axis rotates toward the branch vector (Euler XYZ).
      const rx = Math.atan2(delta[2], delta[1]),
        rz = -Math.asin(delta[0] / length);
      parts.push({
        shape: "cylinder",
        position: a.map((v, i) => (v + b[i]) / 2) as [number, number, number],
        scale: [radius, length, radius],
        rotation: [rx, 0, rz],
        color: spec.trunk,
      });
    };
    const h = spec.height,
      w = spec.spread;
    branch([0, 0, 0], [h * 0.035, h * 0.3, 0], h * 0.055);
    branch(
      [h * 0.035, h * 0.3, 0],
      [-h * 0.025, h * 0.57, h * 0.025],
      h * 0.045,
    );
    branch(
      [-h * 0.025, h * 0.57, h * 0.025],
      [h * 0.035, h * 0.79, 0],
      h * 0.029,
    );
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3 + (random() - 0.5) * 0.25,
        reach = w * (0.55 + random() * 0.25);
      const base: [number, number, number] = [0, h * (0.3 + i * 0.055), 0];
      const elbow: [number, number, number] = [
        Math.cos(angle) * reach * 0.52,
        h * (0.61 + random() * 0.1),
        Math.sin(angle) * reach * 0.52,
      ];
      const tip: [number, number, number] = [
        Math.cos(angle) * reach,
        h * (0.76 + random() * 0.17),
        Math.sin(angle) * reach,
      ];
      branch(base, elbow, h * 0.025);
      branch(elbow, tip, h * 0.014);
      for (let j = 0; j < 6; j++) {
        const a = angle + (j * Math.PI) / 3,
          r = w * (0.2 + random() * 0.055) * (0.7 + 0.3 * spec.bloom);
        parts.push({
          shape: "ball",
          position: [
            tip[0] + Math.cos(a) * r * 0.65,
            tip[1] + (random() - 0.4) * h * 0.1,
            tip[2] + Math.sin(a) * r * 0.65,
          ],
          scale: [r, r * 0.62, r * 0.85],
          color: spec.foliage,
        });
      }
      branch(
        [0, 0.25, 0],
        [Math.cos(angle) * h * 0.13, 0.12, Math.sin(angle) * h * 0.13],
        h * 0.018,
      );
    }
    parts.push({
      shape: "ball",
      position: [0, h * 0.85, 0],
      scale: [w * 0.26, h * 0.15, w * 0.24],
      color: spec.foliage,
    });
    if (spec.fallingPetals)
      effects = [
        {
          kind: "falling-petals",
          position: [0, h * 0.5, 0],
          extent: [w * 2, h, w * 1.6],
          color: spec.foliage,
          rate: 0.3,
          seed: spec.seed,
        },
      ];
  }
  const radius = Math.max(
    0.2,
    ...parts.map((p) =>
      Math.max(
        Math.abs(p.position[0]) + p.scale[0],
        Math.abs(p.position[2]) + p.scale[2],
      ),
    ),
  );
  if (radius > 25) throw Error("生成组件超出受支持的空间预算");
  return validateRecipes([
    {
      id: entry.id,
      version: entry.version,
      name: entry.name,
      tags: entry.tags,
      placement: spec.generator === "assembly" ? spec.placement : "landmark",
      footprint: radius,
      origin: "generated",
      parts,
      ...(effects ? { effects } : {}),
    },
  ])[0];
}
