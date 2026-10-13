/** A walk-through space declares its physical passage. Rendering and route
 * planning share these dimensions; names and song identities play no role. */
export interface PassageCapability {
  halfLength: number;
  width: number;
  height: number;
  focus: [number, number, number];
  focusAsset?: string;
  focusPart?: string;
  sheltered: boolean;
}
export interface Traversal {
  objectIndex: number;
  lateral: number;
  passage: PassageCapability;
}
export function detourProfile(
  center: number,
  before: number,
  after: number,
  halfLength: number,
) {
  const reach = Math.min(center - before, after - center);
  const inner = halfLength + 3;
  const outer = Math.min(inner + 18, reach * 0.95);
  return { center, inner, outer, feasible: outer >= inner + 4 };
}
export function lateralAt(
  delta: number,
  inner: number,
  outer: number,
  lateral: number,
) {
  if (outer <= inner) return 0;
  const u = Math.max(
    0,
    Math.min(1, (Math.abs(delta) - inner) / (outer - inner)),
  );
  return lateral * (1 - u * u * (3 - 2 * u));
}
