export interface LayoutViewEvidence {
  sequenceId: string;
  aspect: number;
  view: "first" | "overhead";
  accepted: boolean;
  passingFraction: number;
  overflow: number;
  unknownFrames: number;
  primaryHeight: number;
  primaryDepth: number;
  presenceDeficit?: number;
}
export interface PresencePolicy {
  minimumHeight: number;
  retainHeightRatio: number;
  maximumDepth: number;
  retainDepthRatio: number;
}
export const defaultPresence: PresencePolicy = {
  minimumHeight: 0.25,
  retainHeightRatio: 0.65,
  maximumDepth: 110,
  retainDepthRatio: 1.2,
};
function matching(
  before: LayoutViewEvidence,
  after: readonly LayoutViewEvidence[],
) {
  return after.find(
    (v) =>
      v.sequenceId === before.sequenceId &&
      v.aspect === before.aspect &&
      v.view === before.view,
  );
}
export const layoutQuality = (views: readonly LayoutViewEvidence[]) =>
  views.reduce(
    (n, v) =>
      n +
      (v.accepted ? 100 : 0) +
      v.passingFraction * 10 -
      v.overflow * 2 -
      v.unknownFrames * 0.05 -
      (v.presenceDeficit ?? 0) * 40,
    0,
  );
export const noViewRegression = (
  before: readonly LayoutViewEvidence[],
  after: readonly LayoutViewEvidence[],
) =>
  before.every((b) => {
    const a = matching(b, after);
    return (
      a &&
      (!b.accepted || a.accepted) &&
      a.passingFraction + 1e-8 >= b.passingFraction &&
      a.unknownFrames <= b.unknownFrames
    );
  });
/** Preserve readable size and depth instead of obtaining a passing crop by
 * pushing scenery into the far fog. This is a layout gate, not an art score.
 * A pre-existing small/distant subject cannot be made worse by a repair. */
export const preservesPresence = (
  before: readonly LayoutViewEvidence[],
  after: readonly LayoutViewEvidence[],
  policy = defaultPresence,
) =>
  before.every((b) => {
    const a = matching(b, after);
    return (
      a &&
      a.primaryHeight >=
        Math.min(
          b.primaryHeight,
          Math.max(
            policy.minimumHeight,
            b.primaryHeight * policy.retainHeightRatio,
          ),
        ) &&
      a.primaryDepth <=
        Math.max(policy.maximumDepth, b.primaryDepth * policy.retainDepthRatio)
    );
  });
