import * as T from "three";
import type { Segment } from "./path";
import type { SequenceScene } from "./sequence-scene";
import { PlacementSession } from "./placement";
import { SightIndex } from "./sight-index";
import { compileCameraProgram, type CameraProgram } from "./camera-program";
import { cameraPair } from "./player-camera";
import { sequenceStop } from "./sequences";
import {
  layoutCandidates,
  refineLayout,
  type LayoutCandidate,
} from "./domain/layout-candidates";
import type { SpatialProxy } from "./domain/spatial";
import type { SightSurface } from "./domain/visibility";
import {
  updateAssemblyAnchors,
  updateAssemblyFacing,
  assemblyPartsOverlap,
} from "./scene-assembly";
import {
  layoutQuality as quality,
  noViewRegression as noRegression,
  preservesPresence,
  type LayoutViewEvidence,
} from "./domain/layout-evaluation";
export interface LayoutAttempt {
  candidate: LayoutCandidate;
  routeSafe: boolean | null;
  outcome:
    | "baseline"
    | "route-rejected"
    | "part-overlap"
    | "view-regression"
    | "presence-regression"
    | "no-gain"
    | "improved";
  views: LayoutViewEvidence[];
}
export interface LayoutRepairRecord {
  sequenceId: string;
  placementId: string;
  status: "unchanged" | "repaired" | "improved-unresolved";
  selectedId: string;
  attempts: LayoutAttempt[];
}
export interface LayoutRepairReport {
  version: 1;
  aspects: number[];
  records: LayoutRepairRecord[];
}
const summarize = (program: CameraProgram): LayoutViewEvidence[] =>
  [...program.shots.values()].flatMap((shot) =>
    (["first", "overhead"] as const).map((view) => {
      const selected = shot.selections[view].selected;
      return {
        sequenceId: shot.sequenceId,
        aspect: program.aspect,
        view,
        accepted: selected.accepted,
        passingFraction: selected.passingFraction,
        overflow: Math.max(
          0,
          ...(selected.framing.composition ?? []).map(
            (s) => s.bounds?.overflow ?? 0,
          ),
        ),
        unknownFrames:
          selected.window?.filter((w) => w.status === "unknown").length ?? 0,
        primaryHeight: Math.min(
          ...(selected.window?.length
            ? selected.window.map((w) => w.primaryHeight ?? 0)
            : [0]),
        ),
        primaryDepth: Math.max(
          0,
          ...(selected.window ?? []).map((w) => w.primaryDepth ?? 0),
        ),
        presenceDeficit: Math.max(
          0,
          ...(selected.window ?? []).map((w) => w.presenceDeficit ?? 0),
        ),
      };
    }),
  );

/** Construction-time joint search. A rigid scenic assembly may move; the route,
 * observer, required subjects, meshes and public view ownership never change.
 * Layout is selected for a fixed responsive envelope and never on a view switch. */
export function repairLayouts(
  observerScale: number,
  path: Segment[],
  scenes: readonly SequenceScene[],
  placement: PlacementSession,
): LayoutRepairReport {
  // Build once for the supported narrow-phone through landscape envelope.
  // Actual aspects are still checked by the camera compiler; resizing never
  // mutates the scenery or silently relaxes its declared framing contract.
  const aspects = [16 / 10, 9 / 21];
  const report: LayoutRepairReport = { version: 1, aspects, records: [] };
  const evaluate = (
    proxies: readonly SpatialProxy[],
    surfaces: readonly SightSurface[],
    nodes = scenes,
  ) => {
    const sight = new SightIndex(surfaces);
    try {
      return aspects.flatMap((aspect) =>
        summarize(
          compileCameraProgram(
            path,
            observerScale,
            nodes,
            proxies,
            sight,
            aspect,
          ),
        ),
      );
    } finally {
      sight.dispose();
    }
  };
  let worldEvidence = evaluate(placement.proxies, placement.sightSurfaces);
  for (const scene of scenes) {
    const assembly = scene.assembly;
    if (!assembly || scene.focusKind !== "subject") continue;
    const entityId = scene.sequence.composition?.entityId;
    const related = scenes.filter(
      (s) =>
        s === scene ||
        (entityId && s.sequence.composition?.entityId === entityId),
    );
    const before = worldEvidence.filter((v) =>
      related.some((s) => s.sequence.id === v.sequenceId),
    );
    const root = assembly.root,
      origin = root.position.clone(),
      rotation = root.quaternion.clone();
    const box = new T.Box3().setFromObject(root),
      span = Math.hypot(box.max.x - box.min.x, box.max.z - box.min.z);
    const at = scene.sequence.composition?.score
      ? sequenceStop(scene.sequence)
      : scene.sequence.start +
        (scene.sequence.end - scene.sequence.start) * 0.55;
    const eye = cameraPair(path, at, observerScale).first.position;
    const originalFocus = scene.focus.toArray();
    const limits = { maxDistance: 90, maxYawDegrees: 45, maxCandidates: 36 };
    const candidates = layoutCandidates(
      eye,
      originalFocus,
      span,
      limits,
      !!assembly.parts?.length,
      before.some((v) => (v.presenceDeficit ?? 0) > 0),
    );
    const parts = (assembly.parts ?? []).map((part) => ({
      ...part,
      origin: part.root.position.clone(),
    }));
    const side = new T.Vector3(
      scene.focus.z - eye[2],
      0,
      eye[0] - scene.focus.x,
    ).normalize();
    const record: LayoutRepairRecord = {
      sequenceId: scene.sequence.id,
      placementId: assembly.placementId,
      status: "unchanged",
      selectedId: "baseline",
      attempts: [
        {
          candidate: candidates[0],
          routeSafe: true,
          outcome: "baseline",
          views: before,
        },
      ],
    };
    report.records.push(record);
    if (before.every((v) => v.accepted)) continue;
    let best = candidates[0],
      bestViews = before,
      bestWorld = worldEvidence;
    const apply = (candidate: LayoutCandidate) => {
      root.position.copy(origin);
      root.quaternion.copy(rotation);
      for (const part of parts) part.root.position.copy(part.origin);
      root.updateWorldMatrix(true, false);
      const pivot = new T.Vector3(...assembly.anchors[0].local);
      if (assembly.anchors[0].owner) {
        root.updateWorldMatrix(true, true);
        assembly.anchors[0].owner.localToWorld(pivot);
        root.worldToLocal(pivot);
      }
      const desired = root
        .localToWorld(pivot.clone())
        .add(new T.Vector3(...candidate.displacement));
      root.rotateY((candidate.yawDegrees * Math.PI) / 180);
      root.updateWorldMatrix(true, false);
      const offset = desired.sub(root.localToWorld(pivot.clone()));
      const world = root.getWorldPosition(new T.Vector3()).add(offset);
      root.position.copy(root.parent ? root.parent.worldToLocal(world) : world);
      root.updateWorldMatrix(true, true);
      if (candidate.primaryDisplacement) {
        for (const part of parts.filter((p) => p.role === "primary")) {
          const position = part.root
            .getWorldPosition(new T.Vector3())
            .add(new T.Vector3(...candidate.primaryDisplacement));
          part.root.position.copy(part.root.parent!.worldToLocal(position));
        }
      }
      if (candidate.partSpread !== undefined) {
        const center = root.localToWorld(pivot.clone());
        for (const part of parts) {
          const position = part.root.getWorldPosition(new T.Vector3());
          const lateral = position.clone().sub(center).dot(side);
          position.addScaledVector(side, lateral * (candidate.partSpread - 1));
          part.root.position.copy(part.root.parent!.worldToLocal(position));
        }
      }
      updateAssemblyFacing(assembly.facing);
      updateAssemblyAnchors(assembly);
    };
    try {
      function* searchCandidates() {
        const split = limits.maxCandidates - 4;
        yield* candidates.slice(1, split);
        yield* best.id === "baseline"
          ? candidates.slice(split)
          : refineLayout(best, eye, originalFocus, span, {
              ...limits,
              maxCandidates: 4,
            });
      }
      for (const candidate of searchCandidates()) {
        apply(candidate);
        if (
          (candidate.partSpread !== undefined ||
            candidate.primaryDisplacement) &&
          assemblyPartsOverlap(parts)
        ) {
          record.attempts.push({
            candidate,
            routeSafe: null,
            outcome: "part-overlap",
            views: [],
          });
          continue;
        }
        const proposal = placement.proposeReplacement(
          assembly.placementId,
          root,
        );
        if (proposal.issues.length) {
          record.attempts.push({
            candidate,
            routeSafe: false,
            outcome: "route-rejected",
            views: [],
          });
          continue;
        }
        const proxies = [
          ...placement.proxies.filter((p) => p.instanceId !== proposal.id),
          ...proposal.proxies,
        ];
        const surfaces = [
          ...placement.sightSurfaces.filter(
            (s) => s.instanceId !== proposal.id,
          ),
          ...proposal.surfaces,
        ];
        const views = evaluate(proxies, surfaces, related);
        let outcome: LayoutAttempt["outcome"] = !preservesPresence(
          before,
          views,
        )
          ? "presence-regression"
          : !noRegression(before, views)
            ? "view-regression"
            : quality(views) - candidate.effort <=
                quality(bestViews) - best.effort + 0.1
              ? "no-gain"
              : "improved";
        // Only potentially useful candidates need the more expensive all-scene check.
        if (outcome === "improved") {
          const otherScenes = scenes.filter((s) => !related.includes(s));
          const others = evaluate(proxies, surfaces, otherScenes);
          const combined = [...views, ...others];
          if (
            !noRegression(worldEvidence, combined) ||
            !preservesPresence(worldEvidence, combined)
          )
            outcome = "view-regression";
          else {
            best = candidate;
            bestViews = views;
            bestWorld = combined;
          }
        }
        record.attempts.push({ candidate, routeSafe: true, outcome, views });
        if (bestViews.every((v) => v.accepted)) break;
      }
      apply(best);
      if (best.id !== "baseline") {
        placement.commitReplacement(
          placement.proposeReplacement(assembly.placementId, root),
        );
        record.selectedId = best.id;
        record.status = bestViews.every((v) => v.accepted)
          ? "repaired"
          : "improved-unresolved";
        worldEvidence = bestWorld;
      }
    } catch (error) {
      apply(candidates[0]);
      throw error;
    }
  }
  return report;
}
