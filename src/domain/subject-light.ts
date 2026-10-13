/** Bounded local fill rig. Direction is derived from the observer-to-subject
 * relationship so a large crown does not receive its key light from below. */
export function subjectLight(
  position: readonly number[],
  height: number,
  enclosed = false,
) {
  const distance = Math.max(1, Math.hypot(position[0], position[2]));
  const reach = enclosed ? 1.8 : Math.max(4, Math.min(15, height * 0.65));
  return {
    offset: [
      (-position[0] / distance) * reach,
      enclosed ? 2.4 : Math.max(4, height * 0.55),
      (-position[2] / distance) * reach,
    ] as [number, number, number],
    power: enclosed ? 40 : Math.min(700, 90 + height * height * 1.2),
    range: enclosed ? 20 : 90,
    decay: 2,
  };
}
