import type { Vec3 } from "./spatial";

export interface LayoutCandidate {
  id: string;
  displacement: Vec3;
  yawDegrees: number;
  effort: number;
  partSpread?: number;
  primaryDisplacement?: Vec3;
}
export interface LayoutLimits {
  maxDistance: number;
  maxYawDegrees: number;
  maxCandidates: number;
}
/** Small deterministic coordinate refinement around a useful coarse result.
 * It consumes the caller's existing candidate budget, not an unbounded retry. */
export function refineLayout(
  best: LayoutCandidate,
  eye: Vec3,
  focus: Vec3,
  span: number,
  limits: LayoutLimits,
): LayoutCandidate[] {
  const dx = focus[0] - eye[0],
    dz = focus[2] - eye[2];
  const length = Math.hypot(dx, dz) || 1;
  const forward: Vec3 = [dx / length, 0, dz / length];
  const right: Vec3 = [forward[2], 0, -forward[0]];
  const step = Math.min(4, Math.max(1, span * 0.04));
  const moves: Vec3[] = [forward, right].flatMap((axis) =>
    [-1, 1].map((sign) => axis.map((v) => v * step * sign) as Vec3),
  );
  return moves
    .map((move, index) => ({
      ...best,
      id: `${best.id}/refine-${index}`,
      displacement: best.displacement.map((v, i) => v + move[i]) as Vec3,
      effort: best.effort + step / Math.max(1, limits.maxDistance),
    }))
    .filter((c) => Math.hypot(...c.displacement) <= limits.maxDistance)
    .slice(0, limits.maxCandidates);
}
/** World-space rigid assembly moves; no asset IDs, mesh scaling, eye movement or
 * layout changes on view switches. The observation axis supplies a local basis. */
export function layoutCandidates(
  eye: Vec3,
  focus: Vec3,
  span: number,
  limits: LayoutLimits,
  independentParts = false,
  preferApproach = false,
): LayoutCandidate[] {
  const dx = focus[0] - eye[0],
    dz = focus[2] - eye[2],
    length = Math.hypot(dx, dz);
  const forward: Vec3 =
    length > 1e-6 ? [dx / length, 0, dz / length] : [0, 0, 1];
  const right: Vec3 = [forward[2], 0, -forward[0]];
  const step = Math.min(limits.maxDistance / 3, Math.max(8, span * 0.35));
  const candidates: LayoutCandidate[] = [
    { id: "baseline", displacement: [0, 0, 0], yawDegrees: 0, effort: 0 },
  ];
  const add = (depth: number, side: number, yaw: number) => {
    const displacement = forward.map(
      (v, i) => v * depth + right[i] * side,
    ) as Vec3;
    const distance = Math.hypot(...displacement);
    if (distance > limits.maxDistance + 1e-6) return;
    candidates.push({
      id: `depth-${depth.toFixed(2)}/side-${side.toFixed(2)}/yaw-${yaw}`,
      displacement,
      yawDegrees: yaw,
      effort:
        distance / Math.max(1, limits.maxDistance) +
        (Math.abs(yaw) / Math.max(1, limits.maxYawDegrees)) * 0.2,
    });
  };
  if (preferApproach) {
    // Never jump beyond the observer. Physical route and shared-view checks are
    // still mandatory for every proposal; this only enumerates bounded trials.
    for (const ratio of [0.15, 0.3, 0.45, 0.6, 0.72])
      add(-Math.min(limits.maxDistance, length * ratio), 0, 0);
    if (independentParts) {
      for (const ratio of [0.15, 0.3, 0.45, 0.6, 0.72]) {
        const distance = Math.min(limits.maxDistance, length * ratio);
        candidates.push({
          id: `primary-approach-${distance.toFixed(2)}`,
          displacement: [0, 0, 0],
          primaryDisplacement: forward.map((v) => -v * distance) as Vec3,
          yawDegrees: 0,
          effort: distance / Math.max(1, limits.maxDistance) + 0.1,
        });
      }
      for (const ratio of [0.3, 0.45, 0.6])
        for (const side of [-1, 1]) {
          const distance = Math.min(limits.maxDistance * 0.8, length * ratio),
            lateral = Math.min(12, Math.max(3, span * 0.12)) * side;
          const move = forward.map(
            (v, i) => -v * distance + right[i] * lateral,
          ) as Vec3;
          if (Math.hypot(...move) <= limits.maxDistance)
            candidates.push({
              id: `primary-approach-${distance.toFixed(2)}/side-${side}`,
              displacement: [0, 0, 0],
              primaryDisplacement: move,
              yawDegrees: 0,
              effort: Math.hypot(...move) / limits.maxDistance + 0.15,
            });
        }
    }
  }
  for (const depth of [
    step * 0.25,
    step * 0.5,
    step,
    step * 1.5,
    step * 2,
    step * 3,
  ])
    add(depth, 0, 0);
  for (const side of [-step * 0.5, step * 0.5, -step, step]) {
    add(0, side, 0);
    add(step * 0.5, side, 0);
    add(step, side, 0);
  }
  for (const yaw of [
    -limits.maxYawDegrees * 0.5,
    limits.maxYawDegrees * 0.5,
    -limits.maxYawDegrees,
    limits.maxYawDegrees,
  ]) {
    add(0, 0, yaw);
    add(step * 0.5, 0, yaw);
    add(step, 0, yaw);
  }
  const rigid = candidates.slice(0, Math.max(1, limits.maxCandidates));
  if (!independentParts) return rigid;
  // Re-space independent subjects along the lateral viewing axis; their own
  // shape, height, attachments and required status remain unchanged.
  const flexible = candidates
    .filter((c) => c.yawDegrees === 0 && Math.hypot(...c.displacement) <= step)
    .flatMap((c) =>
      [0.72, 0.5].map((partSpread) => ({
        ...c,
        id: `${c.id}/spread-${partSpread}`,
        partSpread,
        effort: c.effort + (1 - partSpread) * 0.5,
      })),
    );
  return (
    preferApproach
      ? [...rigid.slice(0, 17), ...flexible.slice(0, 4), ...rigid.slice(17)]
      : [rigid[0], ...flexible, ...rigid.slice(1)]
  ).slice(0, Math.max(1, limits.maxCandidates));
}
