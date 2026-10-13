export type VisualEffect = {
  kind: "falling-water" | "falling-petals" | "water-mist";
  position: [number, number, number];
  extent: [number, number, number];
  color: string;
  rate: number;
  seed: number;
};
/** Declarative, bounded motion. No expressions, shaders or callbacks enter from a plan. */
export function validateVisualEffects(raw: unknown): VisualEffect[] {
  if (!Array.isArray(raw) || raw.length > 6) throw Error("动态效果数量无效");
  return raw.map((value) => {
    const effect = value as VisualEffect;
    const vector = (
      v: unknown,
      min: number,
      max: number,
    ): v is [number, number, number] =>
      Array.isArray(v) &&
      v.length === 3 &&
      v.every(
        (n) =>
          typeof n === "number" && Number.isFinite(n) && n >= min && n <= max,
      );
    if (
      !effect ||
      !["falling-water", "falling-petals", "water-mist"].includes(effect.kind) ||
      !vector(effect.position, -40, 40) ||
      !vector(effect.extent, 0.1, 40) ||
      !/^#[a-f0-9]{6}$/i.test(effect.color) ||
      !Number.isFinite(effect.rate) ||
      effect.rate < 0.1 ||
      effect.rate > 4 ||
      !Number.isInteger(effect.seed) ||
      effect.seed < 0 ||
      effect.seed > 4294967295
    )
      throw Error("动态效果参数无效");
    return {
      kind: effect.kind,
      position: [...effect.position],
      extent: [...effect.extent],
      color: effect.color,
      rate: effect.rate,
      seed: effect.seed,
    };
  });
}
