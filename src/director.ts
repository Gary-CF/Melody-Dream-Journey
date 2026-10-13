import type { viewpoints } from "./domain/narrative-vocabulary";
export type View = keyof typeof viewpoints;
export const smooth = (x: number) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};
export function lightProgress(elapsed: number, seconds: number) {
  const s = Math.max(0.1, seconds);
  return {
    sky: smooth(elapsed / s),
    key: smooth(elapsed / (s * 0.85)),
    lamps: smooth((elapsed - s * 0.12) / (s * 0.88)),
    exposure: smooth(elapsed / s),
  };
}
// Camera poses derive only from timeline coordinates, so seeking and replay agree.
export function cameraPose(
  view: View,
  pos: { x: number; z: number },
  forward: { x: number; z: number },
  phase: number,
  scale = 1,
) {
  const presets: Record<View, [number, number, number, number]> = {
    overhead: [7, 24, 13, 5],
    follow: [1.5, 7, 10, 6],
    eye: [1.1, 1.65, 4, 8],
    shoulder: [0.8, 2.1, 3, 8],
    first: [0, 1.05, -0.35, 10],
    still: [1.2, 5, 8, 4],
    reveal: [
      5 + 8 * smooth(phase),
      8 + 16 * smooth(phase),
      12 + 12 * smooth(phase),
      8,
    ],
  };
  const [side, height, back, lookAhead] = presets[view],
    fx = forward.x,
    fz = forward.z;
  return {
    position: [
      pos.x - fx * back + fz * side,
      height * (view === "first" ? scale : 1),
      pos.z - fz * back - fx * side,
    ],
    target: [
      pos.x + fx * lookAhead,
      view === "first" ? 1.05 * scale : 1.1,
      pos.z + fz * lookAhead,
    ],
  };
}
