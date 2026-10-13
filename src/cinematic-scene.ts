import * as T from "three";
import type { Kit } from "./assets";
import type { Plan } from "./model";
import { positionAt, basePositionAt, type Segment } from "./path";
import { sequenceStop, type Sequence } from "./sequences";
import type { SequenceScene } from "./sequence-scene";
import type { PlacementSession } from "./placement";
import { SpatialBuildError } from "./placement";
import { releaseCandidate } from "./spatial-adapter";
import type { Vec3 } from "./domain/spatial";
import type { SubjectComposition } from "./domain/composition";
import {
  updateAssemblyFacing,
  type AssemblyPart,
  type FacingConstraint,
} from "./scene-assembly";
import { buildPassageWalkway } from "./passage-scene";
import { shoreSupport } from "./shore-support";
import { subjectLight } from "./domain/subject-light";
import { framingPolicy } from "./domain/framing-policy";
import {
  bindCapabilityObservation,
  capabilityCenter,
} from "./capability-observation";

function focusCinematicSubject(
  node: SequenceScene,
  owner: SequenceScene = node,
) {
  const spec = node.sequence.composition!,
    primary = node.primaryEntity;
  if (!primary || !spec.score || !spec.entityId) return;
  const wholeId = primary.root.userData.spatialSubjectId;
  node.subjectComposition = primary.subjects
    .filter((subject) => {
      if (!subject.subjectId.startsWith(`${wholeId}/capability-`)) return true;
      return spec.commitments?.some(
        (c) =>
          c.essential &&
          subject.subjectId === `${wholeId}/capability-${c.capability}`,
      );
    })
    .map((subject) =>
      subject.subjectId === wholeId
        ? {
            ...subject,
            minimumSpan: spec.framing
              ? { first: framingPolicy[spec.framing].minimumSpan }
              : undefined,
            viewCrop:
              spec.framing === "intimate" ? { first: "coverage" } : undefined,
          }
        : { ...subject },
    );
  node.focusSubjects = node.subjectComposition.map(
    (subject) => subject.subjectId,
  );
  const claim = spec.commitments?.[0];
  if (
    !claim ||
    !spec.bindings?.some(
      (b) =>
        b.claimId === claim.id &&
        b.target === "component" &&
        b.objectIndex === 0,
    )
  )
    return;
  const center = capabilityCenter(primary.root, claim.capability);
  if (!center) {
    if (["falling-water", "water-pool"].includes(claim.capability))
      throw Error(
        `主要画面缺少工厂提供的可定位观察区域：${claim.capability}；不能用整个组件替代局部主体`,
      );
    return;
  }
  const featureId = `${wholeId}/capability-${claim.capability}`;
  node.focus = center;
  owner.assembly?.anchors.push({
    local: primary.owner.worldToLocal(center.clone()).toArray(),
    world: center,
    owner: primary.owner,
  });
  node.subjectComposition = node.subjectComposition.map((subject) => {
    if (subject.subjectId === wholeId)
      return { ...subject, views: ["overhead"], minimumSpan: undefined };
    if (subject.subjectId === featureId)
      return {
        ...subject,
        role: "primary",
        views: ["first"],
        minimumSpan: spec.framing
          ? { first: framingPolicy[spec.framing].minimumSpan }
          : undefined,
        viewCrop:
          spec.framing === "intimate" ? { first: "coverage" } : undefined,
      };
    return subject;
  });
}

/** Data-driven cinematic assembly. No world-name, song-name or legacy highlight switches. */
export function buildCinematicScene(
  k: Kit,
  p: Plan,
  path: Segment[],
  sequence: Sequence,
  placement: PlacementSession,
  entities?: Map<string, SequenceScene>,
): SequenceScene {
  const spec = sequence.composition;
  if (!spec) throw Error("创作编排缺少可执行场景");
  const stop = (spec.traversal ? basePositionAt : positionAt)(
      path,
      sequenceStop(sequence),
    ),
    group = new T.Group(),
    scenery = new T.Group(),
    fixed = new T.Group();
  group.position.set(stop.x, 0, stop.z);
  group.rotation.y = stop.heading;
  const shared = spec.entityId ? entities?.get(spec.entityId) : undefined;
  if (shared) {
    const node: SequenceScene = {
      ...shared,
      sequence,
      group,
      anchor: group.position.clone(),
      heading: stop.heading,
      assembly: undefined,
      subjectComposition: shared.subjectComposition.map((subject) =>
        subject.role !== "primary"
          ? subject
          : {
              ...subject,
              viewCrop:
                spec.framing === "intimate" ? { first: "coverage" } : undefined,
              minimumSpan: spec.framing
                ? { first: framingPolicy[spec.framing].minimumSpan }
                : undefined,
            },
      ),
    };
    focusCinematicSubject(node, shared);
    return node;
  }
  group.add(scenery, fixed);
  try {
    const subjects: string[] = [],
      compositions: SubjectComposition[] = [],
      parts: AssemblyPart[] = [],
      facing: FacingConstraint[] = [],
      lamps: T.Vector3[] = [];
    let primary: T.Object3D | undefined;
    let primaryOwner: T.Group | undefined;
    let roof: T.Object3D | undefined;
    const cutaways: T.Object3D[] = [];
    for (const [i, object] of spec.objects.entries()) {
      const mesh = k.create(object.assetId),
        part = new T.Group();
      mesh.scale.setScalar(object.scale);
      mesh.rotation.y = object.rotation ?? 0;
      // Measure in assembly-local coordinates before attaching to the transformed world.
      mesh.updateMatrixWorld(true);
      const localBounds = new T.Box3().setFromObject(mesh);
      part.position.fromArray(object.position);
      part.add(mesh);
      const isPassage = spec.traversal?.objectIndex === i;
      (isPassage ? fixed : scenery).add(part);
      if (spec.score && !isPassage)
        facing.push({
          root: part,
          localYaw: mesh.rotation.y,
          target: [stop.x, 0, stop.z],
        });
      const id = `${sequence.id}/object-${i}`;
      let subject: T.Object3D = mesh;
      if (isPassage) {
        const target = spec.traversal!.passage.focusAsset,
          targetPart = spec.traversal!.passage.focusPart;
        if (target || targetPart) {
          const found: T.Object3D[] = [];
          mesh.traverse((o) => {
            if (
              (target && o.userData.coreId === target) ||
              (targetPart && o.name === targetPart)
            )
              found.push(o);
          });
          if (found.length !== 1) throw Error("通行组件没有唯一的室内观察主体");
          subject = found[0];
        }
        mesh.traverse((o) => {
          if (o.name === "cutaway-roof") {
            roof = o;
            o.userData.noBatch = true;
          }
          if (o.name === "cutaway-wall") cutaways.push(o);
        });
      }
      subject.userData.spatialSubjectId = id;
      const claimScenes =
        object.role === "primary" && spec.entityId
          ? (p.sequences ?? [])
              .map((s) => s.composition)
              .filter((s) => s?.entityId === spec.entityId)
          : [spec];
      for (const claimScene of claimScenes)
        for (const claim of claimScene?.commitments ?? []) {
          if (
            !claim.essential ||
            !claimScene?.bindings?.some(
              (b) =>
                b.claimId === claim.id &&
                b.target === "component" &&
                b.objectIndex === i,
            )
          )
            continue;
          const featureId = `${id}/capability-${claim.capability}`;
          if (
            !subjects.includes(featureId) &&
            bindCapabilityObservation(mesh, claim.capability, featureId)
          ) {
            subjects.push(featureId);
            compositions.push({
              subjectId: featureId,
              role: "supporting",
              crop: "contain",
              margin: { landscape: 0.08, portrait: 0.12 },
            });
          }
        }
      if (p.creativeWorld?.recipe.terrain === "waterfront") {
        const size = localBounds.getSize(new T.Vector3()),
          center = localBounds.getCenter(new T.Vector3());
        // A shoreline support belongs to the assembly; it is not a second asset or subject.
        const base = shoreSupport(
          Math.max(2, size.x * 0.62),
          Math.max(2, size.z * 0.62),
          p.seed + i * 79,
        );
        base.position.set(center.x, 0, center.z);
        part.add(base);
      }
      if (!isPassage)
        parts.push({
          id,
          root: part,
          minimumGap: 0.8,
          role: object.role === "primary" ? "primary" : "supporting",
        });
      if (object.role === "primary") {
        primary = subject;
        primaryOwner = part;
        subjects.push(id);
        compositions.push({
          subjectId: id,
          role: "primary",
          region: { minimumY: 0 },
          crop: "contain",
          // A declared intimate shot may crop the outer silhouette, while
          // the shared overhead camera still has to show the whole subject.
          ...(isPassage ||
          (spec.framing && framingPolicy[spec.framing].crop === "coverage")
            ? { viewCrop: { first: "coverage" as const } }
            : {}),
          margin: { landscape: 0.08, portrait: 0.12 },
          ...(spec.framing && !isPassage
            ? {
                minimumSpan: { first: framingPolicy[spec.framing].minimumSpan },
              }
            : {}),
        });
      }
    }
    if (!primary || !primaryOwner) throw Error("创作场景没有主要视觉主体");
    if (spec.traversal) buildPassageWalkway(k, fixed, path, sequence);
    group.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(primary),
      focus = bounds.getCenter(new T.Vector3());
    const localFocus = primaryOwner.worldToLocal(focus.clone());
    const rig = subjectLight(
      primaryOwner.position.toArray(),
      bounds.max.y - bounds.min.y,
      !!spec.traversal,
    );
    const fill = new T.PointLight(spec.fill, rig.power, rig.range, rig.decay);
    fill.position.copy(localFocus).add(new T.Vector3(...rig.offset));
    primaryOwner.add(fill);
    const localLamp = fill.position.clone(),
      worldLamp = primaryOwner.localToWorld(localLamp.clone());
    lamps.push(worldLamp);
    const offsets: Vec3[] = [[0, 0, 0]];
    for (const distance of [6, 12, 18, 24, 36, 48, 60])
      for (const [x, z] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        offsets.push([x * distance, 0, z * distance]);
    const placementId = `sequence/${sequence.id}/scenery`,
      result = placement.place(placementId, scenery, offsets, [0, 0, 0], () =>
        updateAssemblyFacing(facing),
      );
    if (result.status === "rejected")
      throw new SpatialBuildError(
        "自动创作场景无法避开通行路线",
        placement.records,
      );
    for (const part of parts)
      placement.protectObject(placementId, part.root, part.minimumGap / 2);
    if (spec.traversal) {
      const owner = `sequence/${sequence.id}/passage`;
      if (placement.place(owner, fixed).status === "rejected")
        throw new SpatialBuildError(
          "通行空间的入口、内部或出口被阻挡",
          placement.records,
        );
      const roomBounds = new T.Box3()
        .setFromObject(primaryOwner)
        .expandByScalar(0.5);
      placement.protect(owner, {
        min: roomBounds.min.toArray(),
        max: roomBounds.max.toArray(),
      });
    }
    scenery.updateWorldMatrix(true, true);
    focus.copy(primaryOwner.localToWorld(localFocus.clone()));
    worldLamp.copy(primaryOwner.localToWorld(localLamp.clone()));
    const node: SequenceScene = {
      primaryEntity: {
        root: primary,
        owner: primaryOwner,
        subjects: compositions,
      },
      sequence,
      group,
      anchor: group.position.clone(),
      focus,
      focusSubjects: subjects,
      subjectComposition: compositions,
      assembly: spec.traversal
        ? undefined
        : {
            placementId,
            root: scenery,
            anchors: [
              {
                local: localFocus.toArray(),
                world: focus,
                owner: primaryOwner,
              },
              {
                local: localLamp.toArray(),
                world: worldLamp,
                owner: primaryOwner,
              },
            ],
            parts: parts.length > 1 ? parts : undefined,
            facing,
          },
      focusKind: "subject",
      heading: stop.heading,
      roof,
      cutaways,
      ...(spec.traversal?.passage.sheltered
        ? {
            shelter: {
              center: primaryOwner.getWorldPosition(new T.Vector3()),
              halfWidth: spec.traversal.passage.width / 2,
              halfLength: spec.traversal.passage.halfLength,
            },
          }
        : {}),
      lamps,
      fill,
    };
    focusCinematicSubject(node);
    if (spec.entityId) entities?.set(spec.entityId, node);
    return node;
  } catch (error) {
    releaseCandidate(group);
    throw error;
  }
}
