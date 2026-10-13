import type { Vec3 } from "./spatial";
import type { FramingReport, ShotView } from "./shot-intent";

export interface CameraLimits {
  lockedEye: boolean;
  maxYawDegrees: number;
  maxLift: number;
  maxAimDegrees: number;
  maxFovIncrease: number;
  maxFovDecrease?: number;
}
export interface CameraCandidate {
  id: string;
  view: ShotView;
  effort: number;
}
export interface CandidateAssessment {
  view: ShotView;
  bodyClear: boolean;
  withinBudget: boolean;
  clearanceLift: number;
  framing: FramingReport;
  window?: {
    time: number;
    bodyClear: boolean;
    withinBudget: boolean;
    status: FramingReport["status"];
    visibleFraction: number;
    inFrameFraction: number;
    primaryHeight?: number;
    primaryDepth?: number;
    presenceDeficit?: number;
  }[];
}
export interface CandidateResult extends CandidateAssessment {
  id: string;
  score: number;
  accepted: boolean;
  passingFraction: number;
}
export interface CameraSelection {
  status: "selected" | "unresolved";
  selected: CandidateResult;
  attempts: CandidateResult[];
  rejectedBest?: CandidateResult;
  fallback?: "baseline" | "best-effort";
}
const direction = (view: ShotView): Vec3 =>
  view.target.map((v, i) => v - view.position[i]) as Vec3;
function angle(a: Vec3, b: Vec3) {
  return (
    (Math.acos(
      Math.max(
        -1,
        Math.min(
          1,
          a.reduce((v, x, i) => v + x * b[i], 0) /
            (Math.hypot(...a) * Math.hypot(...b) || 1),
        ),
      ),
    ) *
      180) /
    Math.PI
  );
}

/** Finite search budget. A first-person candidate can aim/widen but never move its eye. */
export function cameraCandidates(
  base: ShotView,
  focusPoints: readonly Vec3[],
  limits: CameraLimits,
): CameraCandidate[] {
  const targets = [
    base.target,
    ...focusPoints.filter(
      (target) =>
        angle(
          direction(base),
          target.map((x, i) => x - base.position[i]) as Vec3,
        ) <= limits.maxAimDegrees,
    ),
  ];
  const moves = limits.lockedEye
    ? [[0, 0]]
    : [
        [0, 0],
        [-limits.maxYawDegrees / 2, 0],
        [limits.maxYawDegrees / 2, 0],
        [0, limits.maxLift / 2],
        [-limits.maxYawDegrees, limits.maxLift / 2],
        [limits.maxYawDegrees, limits.maxLift / 2],
        [0, limits.maxLift],
      ];
  const result: CameraCandidate[] = [];
  for (const [targetIndex, target] of targets.entries())
    for (const [yaw, lift] of moves)
      for (const fov of [
        base.fov,
        Math.min(85, base.fov + limits.maxFovIncrease),
        ...(limits.maxFovDecrease
          ? [Math.max(38, base.fov - limits.maxFovDecrease)]
          : []),
      ]) {
        const radians = (yaw * Math.PI) / 180,
          dx = base.position[0] - base.target[0],
          dz = base.position[2] - base.target[2];
        const position: Vec3 = limits.lockedEye
          ? [...base.position]
          : [
              base.target[0] + dx * Math.cos(radians) - dz * Math.sin(radians),
              base.position[1] + lift,
              base.target[2] + dx * Math.sin(radians) + dz * Math.cos(radians),
            ];
        result.push({
          id: `aim-${targetIndex}/orbit-${yaw}/lift-${lift}/fov-${fov}`,
          view: { position, target: [...target], fov },
          effort:
            Math.abs(yaw) / Math.max(1, limits.maxYawDegrees) +
            lift / Math.max(1, limits.maxLift) +
            Math.abs(fov - base.fov) /
              Math.max(1, limits.maxFovIncrease, limits.maxFovDecrease ?? 0) +
            (targetIndex ? 0.5 : 0),
        });
      }
  return result;
}
export function selectCamera(
  candidates: readonly CameraCandidate[],
  assess: (candidate: CameraCandidate) => CandidateAssessment,
): CameraSelection {
  if (!candidates.length)
    throw Error("Camera selection requires a baseline candidate");
  const attempts = candidates.map((candidate, index) => {
    const result = assess(candidate);
    const accepted =
      result.bodyClear &&
      result.withinBudget &&
      (!result.framing.intent.required || result.framing.status === "visible");
    return {
      ...result,
      id: candidate.id,
      accepted,
      passingFraction: result.window?.length
        ? result.window.filter(
            (w) => w.bodyClear && w.withinBudget && w.status === "visible",
          ).length / result.window.length
        : accepted
          ? 1
          : 0,
      score:
        result.framing.visibleFraction * 4 +
        result.framing.inFrameFraction * 0.25 -
        Math.max(
          0,
          ...(result.framing.composition ?? []).map(
            (c) => c.bounds?.overflow ?? 0,
          ),
        ) *
          2 -
        Math.max(
          0,
          ...(result.window ?? []).map((w) => w.presenceDeficit ?? 0),
        ) *
          12 -
        candidate.effort * 0.22 -
        result.clearanceLift * 0.015 +
        (index === 0 ? 0.35 : 0),
    };
  });
  const rank = (a: CandidateResult, b: CandidateResult) => b.score - a.score;
  const best = attempts.filter((a) => a.accepted).sort(rank)[0];
  const safe = attempts
    .filter((a) => a.bodyClear && a.withinBudget)
    .sort((a, b) => b.passingFraction - a.passingFraction || rank(a, b))[0];
  return best
    ? { status: "selected", selected: best, attempts }
    : {
        status: "unresolved",
        selected: safe ?? attempts[0],
        attempts,
        rejectedBest: [...attempts].sort(rank)[0],
        fallback:
          safe && safe.id !== attempts[0].id ? "best-effort" : "baseline",
      };
}
