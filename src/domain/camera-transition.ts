import type { ShotView } from "./shot-intent";
import type { Vec3 } from "./spatial";
const smooth = (v: number) => {
  const t = Math.max(0, Math.min(1, v));
  return t * t * (3 - 2 * t);
};

/** Eye ownership cannot be interpolated through ceilings or walls. Transfers
 * use an explicit short dip-to-black cut; free-to-free shots blend normally.
 * The owning caller still validates both endpoint camera bodies.
 */
export function transitionCamera(
  from: ShotView,
  to: ShotView,
  elapsed: number,
  seconds: number,
  fromAttached: boolean,
  toAttached: boolean,
) {
  const span = Math.max(0.1, seconds),
    phase = Math.max(0, Math.min(1, elapsed / span));
  const cut = fromAttached !== toAttached;
  const weight = cut ? (phase < 0.5 ? 0 : 1) : smooth(phase);
  const mix = (a: Vec3, b: Vec3): Vec3 =>
    weight === 0
      ? [...a]
      : weight === 1
        ? [...b]
        : (a.map((v, i) => v + (b[i] - v) * weight) as Vec3);
  return {
    track: {
      position: mix(from.position, to.position),
      target: mix(from.target, to.target),
      fov: from.fov + (to.fov - from.fov) * weight,
    },
    eyeAttached: cut
      ? weight === 1
        ? toAttached
        : fromAttached
      : fromAttached && toAttached,
    heroVisible: !(cut
      ? weight === 1
        ? toAttached
        : fromAttached
      : fromAttached && toAttached),
    transition: {
      kind: cut ? ("cut" as const) : ("continuous" as const),
      fade: cut
        ? smooth(1 - Math.abs(elapsed - span / 2) / Math.min(0.18, span / 4))
        : 0,
    },
  };
}
