import type { Vec3 } from "./spatial";
import type { SightHit, SightQuery } from "./visibility";
import {
  compositionBounds,
  projectPoint,
  type CompositionBounds,
  type SubjectComposition,
  type SubjectRegion,
} from "./composition";
export const cameraClip = { near: 0.1, far: 450 } as const;

export interface ShotIntent {
  id: string;
  kind: "direction" | "survey" | "subject";
  phase: "travel" | "approach" | "reveal" | "release";
  subjectIds: readonly string[];
  required: boolean;
  minimumVisibleFraction: number;
  subjects?: readonly SubjectComposition[];
}
export interface ShotView {
  position: Vec3;
  target: Vec3;
  fov: number;
}
export interface SightProvider {
  trace(query: SightQuery): SightHit | undefined;
  samples(
    subjectId: string,
    viewId?: string,
    region?: SubjectRegion,
  ): readonly Vec3[];
  vertices?(
    subjectId: string,
    viewId?: string,
    region?: SubjectRegion,
  ): readonly Vec3[];
}
export interface FramingSample {
  subjectId: string;
  point: Vec3;
  inFrame: boolean;
  hit?: SightHit;
}
export interface FramingReport {
  intent: ShotIntent;
  status:
    | "context"
    | "visible"
    | "obstructed"
    | "out-of-frame"
    | "underfilled"
    | "unknown";
  visibleFraction: number;
  inFrameFraction: number;
  uncertainSamples: number;
  missingSubjectIds: string[];
  samples: FramingSample[];
  referenceHit?: SightHit;
  composition?: {
    subjectId: string;
    role: SubjectComposition["role"];
    crop: SubjectComposition["crop"];
    bounds?: CompositionBounds;
    minimumSpan?: number;
    spanDeficit?: number;
  }[];
}
export function primaryPresence(report: FramingReport): {
  primaryHeight?: number;
  primaryDepth?: number;
  presenceDeficit?: number;
} {
  const bounds = (report.composition ?? [])
    .filter((s) => s.role === "primary" && s.bounds)
    .map((s) => s.bounds!);
  if (!bounds.length) return {};
  return {
    primaryHeight: Math.min(...bounds.map((b) => (b.max[1] - b.min[1]) / 2)),
    primaryDepth: Math.max(...bounds.map((b) => (b.depth[0] + b.depth[1]) / 2)),
    presenceDeficit: Math.max(
      0,
      ...(report.composition ?? []).map((s) => s.spanDeficit ?? 0),
    ),
  };
}
export function inView(view: ShotView, point: Vec3, aspect: number): boolean {
  const p = projectPoint(view, point, aspect);
  return (
    p.depth > cameraClip.near &&
    p.depth <= cameraClip.far &&
    Math.abs(p.x) <= 1 &&
    Math.abs(p.y) <= 1
  );
}

/** Viewing a facade is not an occlusion failure unless a declared subject behind
 * it is required. Sample coverage is a geometric diagnostic, not an art score.
 */
export function inspectFraming(
  view: ShotView,
  intent: ShotIntent,
  provider: SightProvider,
  viewId: string,
  aspect = 16 / 9,
): FramingReport {
  if (intent.kind !== "subject")
    return {
      intent,
      status: "context",
      visibleFraction: 0,
      inFrameFraction: 0,
      uncertainSamples: 0,
      missingSubjectIds: [],
      samples: [],
      referenceHit: provider.trace({
        origin: view.position,
        target: view.target,
        viewId,
      }),
    };
  const samples: FramingSample[] = [];
  const missingSubjectIds: string[] = [];
  const composition: NonNullable<FramingReport["composition"]> = [];
  for (const subjectId of intent.subjectIds) {
    const policy = intent.subjects?.find((s) => s.subjectId === subjectId);
    if (policy?.views && !policy.views.includes(viewId as "first" | "overhead"))
      continue;
    const points = provider.samples(subjectId, viewId, policy?.region);
    if (policy) {
      const vertices =
        provider.vertices?.(subjectId, viewId, policy.region) ?? [];
      const bounds = compositionBounds(
        view,
        vertices,
        aspect,
        aspect < 1 ? policy.margin.portrait : policy.margin.landscape,
      );
      const minimumSpan = policy.minimumSpan?.[viewId as "first" | "overhead"];
      const span = bounds
        ? Math.max(
            bounds.max[0] - bounds.min[0],
            bounds.max[1] - bounds.min[1],
          ) / 2
        : 0;
      composition.push({
        subjectId,
        role: policy.role,
        crop: policy.viewCrop?.[viewId as "first" | "overhead"] ?? policy.crop,
        bounds,
        minimumSpan,
        spanDeficit: Math.max(0, (minimumSpan ?? 0) - span),
      });
    }
    if (!points.length) missingSubjectIds.push(subjectId);
    for (const point of points) {
      const framed = inView(view, point, aspect);
      samples.push({
        subjectId,
        point,
        inFrame: framed,
        hit: framed
          ? provider.trace({
              origin: view.position,
              target: point,
              viewId,
              subjectId,
            })
          : undefined,
      });
    }
  }
  const uncertainSamples = samples.filter(
    (s) => s.hit?.certainty === "dynamic-bound",
  ).length;
  // Each declared subject must be represented; a large visible subject cannot
  // hide a missing or occluded second subject in an aggregate average.
  const coverage = intent.subjectIds
    .filter((id) => {
      const policy = intent.subjects?.find((s) => s.subjectId === id);
      return (
        !policy?.views || policy.views.includes(viewId as "first" | "overhead")
      );
    })
    .map((id) => {
      const subset = samples.filter((s) => s.subjectId === id);
      return {
        visible:
          subset.filter((s) => s.inFrame && !s.hit).length /
          (subset.length || 1),
        framed: subset.filter((s) => s.inFrame).length / (subset.length || 1),
      };
    });
  const visibleFraction = coverage.length
      ? Math.min(...coverage.map((c) => c.visible))
      : 0,
    inFrameFraction = coverage.length
      ? Math.min(...coverage.map((c) => c.framed))
      : 0;
  return {
    intent,
    samples,
    visibleFraction,
    inFrameFraction,
    uncertainSamples,
    missingSubjectIds,
    composition,
    status:
      !samples.length ||
      missingSubjectIds.length ||
      composition.some((c) => c.crop === "contain" && !c.bounds)
        ? "unknown"
        : composition.some(
              (c) =>
                c.crop === "contain" && c.bounds && c.bounds.clippedPoints > 0,
            )
          ? "out-of-frame"
          : visibleFraction >= intent.minimumVisibleFraction
            ? composition.some((c) => (c.spanDeficit ?? 0) > 1e-6)
              ? "underfilled"
              : "visible"
            : uncertainSamples
              ? "unknown"
              : inFrameFraction < intent.minimumVisibleFraction
                ? "out-of-frame"
                : "obstructed",
  };
}
