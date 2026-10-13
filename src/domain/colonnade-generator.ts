import type { PassageCapability } from "./traversal";
import type { Part } from "../design";
import type { ComponentRecipe } from "./creative-library";

export function colonnadePassage(
  spec: Extract<ComponentRecipe, { generator: "colonnade" }>,
): PassageCapability {
  const step = (spec.length - 1) / (spec.bays - 1);
  const z =
    -spec.length / 2 + 0.5 + (Math.floor((spec.bays - 2) / 2) + 0.5) * step;
  return {
    halfLength: spec.length / 2,
    width: spec.width - 2,
    height: spec.height - 0.5,
    focus: [-spec.width / 2 + 1.25, 2, z],
    focusPart: "component-focus",
    sheltered: true,
  };
}

/** A walk-through arcade. Repetition, proportion and roof profile are data;
 * route, shelter and cutaway behavior are supplied by the common capability contract. */
export function generateColonnade(
  spec: Extract<ComponentRecipe, { generator: "colonnade" }>,
): Part[] {
  const { width: w, length: d, height: h } = spec;
  const parts: Part[] = [];
  const box = (
    color: string,
    position: Part["position"],
    scale: Part["scale"],
    extra: Partial<Part> = {},
  ) => parts.push({ shape: "box", color, position, scale, ...extra });
  box(spec.stone, [0, 0.015, 0], [w + 0.8, 0.25, d + 0.8], { role: "support" });
  for (let i = 0; i < spec.bays; i++) {
    const z = -d / 2 + 0.5 + (i / (spec.bays - 1)) * (d - 1);
    for (const side of [-1, 1]) {
      const x = side * (w / 2 - 0.4);
      box(spec.stone, [x, 0.34, z], [0.9, 0.5, 0.9]);
      parts.push({
        shape: "cylinder",
        color: spec.stone,
        position: [x, h / 2, z],
        scale: [0.22, h - 0.6, 0.22],
      });
      box(spec.stone, [x, h - 0.45, z], [0.85, 0.35, 0.85]);
    }
    box(spec.stone, [0, h - 0.18, z], [w, 0.35, 0.48]);
  }
  for (const side of [-1, 1])
    box(spec.stone, [side * (w / 2 - 0.4), h - 0.25, 0], [0.48, 0.45, d + 0.7]);
  if (spec.roof === "gable") {
    const angle = 0.28,
      roofWidth = (w / 2 + 0.8) / Math.cos(angle);
    for (const side of [-1, 1])
      box(
        spec.roofColor,
        [(side * w) / 4, h + 0.35, 0],
        [roofWidth, 0.26, d + 1.6],
        { viewRole: "roof", rotation: [0, 0, -side * angle] },
      );
  } else
    box(spec.roofColor, [0, h + 0.1, 0], [w + 1.2, 0.35, d + 1.2], {
      viewRole: "roof",
    });
  // A small illuminated relief on the side creates a concrete object of attention
  // while leaving the shared walking corridor completely clear.
  const [x, , z] = colonnadePassage(spec).focus;
  box(spec.stone, [x, 0.65, z], [1.0, 1.1, 1.0]);
  parts.push({
    shape: "torus",
    color: spec.accent,
    position: [x, 2.0, z],
    scale: [0.85, 0.85, 0.2],
    rotation: [0, Math.PI / 2, 0],
    glow: true,
    viewRole: "focus",
  });
  return parts;
}
