import * as T from "three";
import { framingPolicy } from "./domain/framing-policy";
import { buildCinematicScene } from "./cinematic-scene";
import type { Kit } from "./assets";
import { positionAt, tavernOffset, type Segment } from "./path";
import type { Plan } from "./model";
import { phaseAt, revealAt, type Sequence } from "./sequences";
import { smooth } from "./director";
import { scoreFrame } from "./domain/cinematic-score";
import type { CameraPair } from "./player-camera";
import { PlacementSession, SpatialBuildError } from "./placement";
import { reserveRoute } from "./domain/route-reservation";
import { observerSpace } from "./domain/observer-space";
import type { Vec3 } from "./domain/spatial";
import { physical, releaseCandidate } from "./spatial-adapter";
import type { ShotView } from "./domain/shot-intent";
import type { SubjectComposition } from "./domain/composition";
import {
  assemblyParts,
  type AssemblyPart,
  type SceneAssembly,
} from "./scene-assembly";
export interface SequenceScene {
  primaryEntity?: {
    root: T.Object3D;
    owner: T.Object3D;
    subjects: SubjectComposition[];
  };
  shelter?: { center: T.Vector3; halfWidth: number; halfLength: number };
  sequence: Sequence;
  group: T.Group;
  anchor: T.Vector3;
  focus: T.Vector3;
  focusSubjects: string[];
  subjectComposition: SubjectComposition[];
  assembly?: SceneAssembly;
  focusKind: "subject" | "survey";
  heading: number;
  roof?: T.Object3D;
  cutaways: T.Object3D[];
  lamps: T.Vector3[];
  fill: T.PointLight;
}
export function buildSequence(
  k: Kit,
  p: Plan,
  path: Segment[],
  sequence: Sequence,
  placement = new PlacementSession(
    reserveRoute(path, observerSpace(p.visual.observerScale).travelEnvelope),
  ),
  entities?: Map<string, SequenceScene>,
): SequenceScene {
  if (sequence.kind === "composition")
    return buildCinematicScene(k, p, path, sequence, placement, entities);
  const stop = positionAt(
    path,
    sequence.start + (sequence.end - sequence.start) * 0.5,
  );
  const group = new T.Group();
  try {
    group.position.set(stop.x, 0.25, stop.z);
    group.rotation.y = stop.heading;
    // Scenic subjects and their focus/light anchors move together. Walkable
    // infrastructure remains bound to the motion route and must pass in place.
    const scenery = new T.Group();
    const backdrop = new T.Group();
    group.add(scenery, backdrop);
    let target = scenery;
    let assetIndex = 0;
    const focusSubjects: string[] = [];
    const subjectComposition: SubjectComposition[] = [];
    const independentSubjects: AssemblyPart[] = [];
    const subject = (
      object: T.Object3D,
      role: SubjectComposition["role"] = "primary",
      independentlyPlaced = false,
    ) => {
      object.userData.spatialSubjectId ??= `${sequence.id}/subject-${assetIndex++}`;
      focusSubjects.push(object.userData.spatialSubjectId);
      if (independentlyPlaced)
        independentSubjects.push({
          id: object.userData.spatialSubjectId,
          root: object,
          minimumGap: 1,
        });
      else
        independentSubjects.push(
          ...assemblyParts(object).map((part) => ({
            ...part,
            id: `${object.userData.spatialSubjectId}/${part.id}`,
          })),
        );
      subjectComposition.push({
        subjectId: object.userData.spatialSubjectId,
        role,
        region: { minimumY: group.position.y },
        crop: "contain",
        margin: { landscape: 0.08, portrait: 0.12 },
      });
      return object;
    };
    const add = (id: string, x: number, y: number, z: number, scale = 1) => {
      const g = k.create("core-" + id);
      g.position.set(x, y, z);
      g.scale.setScalar(scale);
      target.add(g);
      return g;
    };
    const lamps: T.Vector3[] = [];
    const lampFrames: T.Object3D[] = [];
    const lamp = (v: T.Vector3) => {
      lamps.push(v);
      lampFrames.push(target);
    };
    let localFocus = new T.Vector3(18, 7, 22),
      roof: T.Object3D | undefined;
    if (sequence.kind === "bridge") {
      target = group;
      const bridge = add("redBridge", 0, -0.23, 0);
      bridge.scale.x = p.visual.roadWidth / 5;
      for (const x of [
        -p.visual.roadWidth / 2 - 1,
        p.visual.roadWidth / 2 + 1,
      ]) {
        add("stoneLantern", x, 0, -5, 0.8);
        lamp(new T.Vector3(x, 2.8, -5));
      }
      target = scenery;
      k.mesh(scenery, "cylinder", "#7e8199", 20, -0.6, 23, 10, 1.2, 8);
      subject(
        add(
          sequence.focus === "osmanthus"
            ? "osmanthus"
            : sequence.focus === "blossom"
              ? "sakura"
              : "willow",
          20,
          0,
          24,
          sequence.focus === "blossom" || sequence.focus === "osmanthus"
            ? 1.7
            : 1.05,
        ),
      );
      add("pavilion", 5, 0.2, 34, 1.35);
      add("rocks", 15, -0.15, 16, 1.1);
      add("rocks", 25, -0.15, 30, 1.3);
      k.mesh(scenery, "cylinder", "#818e9c", -12, -0.6, 26, 5, 1.2, 5);
      add("willow", -12, -0.2, 26, 0.65);
      add("reeds", 13, -0.2, 16);
      add("lotus", 10, -0.65, 13, 1.5);
      const bridge2 = add("redBridge", 10, 0, 28);
      bridge2.rotation.y = Math.PI / 2;
      target = backdrop;
      add("mountain", 20, -9, 100, 1.4);
      target = scenery;
      for (const [x, z] of [
        [5, 30],
        [10, 28],
        [16, 26],
        [21, 21],
      ]) {
        add("stoneLantern", x, 0, z, 0.8);
        lamp(new T.Vector3(x, 3, z));
      }
      localFocus = new T.Vector3(17, 8, 26);
    } else if (sequence.kind === "tavern") {
      target = group;
      physical(k.box(group, "#8d947f", 0, -0.35, 0, 14, 0.6, 18), "support");
      for (let z = -30; z < 30; z += 0.8) {
        const x =
          -tavernOffset(path, sequence, 0) + tavernOffset(path, sequence, z);
        const nz = z + 0.8,
          nx =
            -tavernOffset(path, sequence, 0) + tavernOffset(path, sequence, nz);
        const plank = k.box(
          group,
          "#b9a48a",
          (x + nx) / 2,
          -0.12,
          (z + nz) / 2,
          2.8,
          0.18,
          Math.hypot(nx - x, 0.8) + 0.05,
        );
        physical(plank, "support");
        plank.rotation.y = Math.atan2(nx - x, 0.8);
      }
      const room = add("tavern", 0, -0.255, 0);
      room.traverse((o) => {
        if (o.userData.coreId === "core-bar") subject(o);
      });
      roof = room.getObjectByName("cutaway-roof");
      localFocus = new T.Vector3(-3, 1.6, 1);
      lamp(new T.Vector3(0, 3.8, -3));
      lamp(new T.Vector3(0, 3.8, 3));
    } else if (sequence.kind === "street") {
      const streetLamp = k.lamp();
      subject(streetLamp);
      streetLamp.position.set(2.6, 0, 13);
      scenery.add(streetLamp);
      lamp(new T.Vector3(2.6, 3.5, 13));
      for (const [x, z] of [
        [-8, 10],
        [8, 23],
        [-8, 29],
      ]) {
        const house = k.create("shop");
        house.position.set(x, 0, z);
        house.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
        scenery.add(house);
      }
      const bench = k.bench();
      bench.position.set(-3.8, 0, 12);
      scenery.add(bench);
      add("willow", -9, 0, 25, 0.6);
      localFocus = new T.Vector3(2.6, 2.5, 13);
    } else if (sequence.kind === "ridge") {
      subject(add("mountain", 8, -6, 40, 1.4));
      add("pine", -10, 0, 17, 1.2);
      add("rocks", 10, -0.3, 10, 2);
      localFocus = new T.Vector3(8, 16, 40);
    } else {
      for (const [x, z, s] of [
        [-18, 26, 1],
        [20, 40, 1.8],
        [9, 28, 0.75],
      ])
        subject(
          add("beacon", x, 0, z, s),
          s > 1 ? "primary" : "supporting",
          true,
        );
      add("neon", -6, 0, 12, 1.4);
      add("truss", 0, 0, 18, 1.8);
      localFocus = new T.Vector3(10, 14, 35);
    }
    // Keep movable roof separate; merged meshes cannot participate in cutaway.
    if (roof)
      group.traverse((o) => {
        if (o === roof) o.userData.noBatch = true;
      });
    group.updateMatrixWorld(true);
    // Offset search is a generic composition policy, independent of song or time.
    const offsets: Vec3[] = [[0, 0, 0]];
    for (const distance of [6, 12, 18, 24, 36, 48, 60, 90, 130, 180]) {
      for (const [x, z] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [0.707, 0.707],
        [-0.707, 0.707],
        [0.707, -0.707],
        [-0.707, -0.707],
      ])
        offsets.push([x * distance, 0, z * distance]);
    }
    const sceneryResult = placement.place(
      `sequence/${sequence.id}/scenery`,
      scenery,
      offsets,
    );
    if (sceneryResult.status === "rejected")
      throw new SpatialBuildError(
        `重点场景无法避开路线：${sequence.id}`,
        placement.records,
      );
    const backdropResult = placement.place(
      `sequence/${sequence.id}/backdrop`,
      backdrop,
      offsets,
    );
    if (backdropResult.status === "rejected")
      throw new SpatialBuildError(
        `远景无法避开路线：${sequence.id}`,
        placement.records,
      );
    // Avoid double registration: validate the fixed subassembly separately.
    group.remove(scenery, backdrop);
    const fixedResult = placement.place(
      `sequence/${sequence.id}/structure`,
      group,
    );
    group.add(scenery, backdrop);
    if (fixedResult.status === "rejected")
      throw new SpatialBuildError(
        `重点场景通道被阻挡：${sequence.id}`,
        placement.records,
      );
    group.updateMatrixWorld(true);
    const focusFrame = sequence.kind === "tavern" ? group : scenery;
    const focus = focusFrame.localToWorld(localFocus.clone()),
      anchor = group.position.clone();
    const worldLamps = lamps.map((l, i) =>
      lampFrames[i].localToWorld(l.clone()),
    );
    const assembly: SceneAssembly | undefined =
      focusFrame === scenery
        ? {
            placementId: `sequence/${sequence.id}/scenery`,
            root: scenery,
            anchors: [
              { local: localFocus.toArray(), world: focus },
              ...lamps.flatMap((l, i) =>
                lampFrames[i] === scenery
                  ? [{ local: l.toArray() as Vec3, world: worldLamps[i] }]
                  : [],
              ),
            ],
            parts:
              independentSubjects.length > 1 ? independentSubjects : undefined,
          }
        : undefined;
    const fill = new T.PointLight(
      sequence.focus === "osmanthus" ? "#ffda8a" : "#ffc3df",
      100,
      65,
      1.7,
    );
    fill.position.set(14, 9, 14);
    if (sequence.kind === "street") {
      fill.position.set(2.6, 3.5, 13);
      fill.color.set("#ffc78d");
      fill.intensity = 25;
      fill.distance = 20;
      fill.decay = 2;
    }
    if (sequence.kind === "tavern") {
      fill.position.set(0, 3.6, 0);
      fill.color.set("#ffbc78");
      fill.intensity = 36;
      fill.distance = 16;
      fill.decay = 2;
    }
    focusFrame.add(fill);
    const cutaways: T.Object3D[] = [];
    group.traverse((o) => {
      if (o.name === "cutaway-wall") cutaways.push(o);
    });
    return {
      cutaways,
      sequence,
      group,
      anchor,
      focus,
      focusSubjects,
      subjectComposition,
      assembly,
      focusKind: sequence.kind === "tavern" ? "survey" : "subject",
      heading: stop.heading,
      roof,
      lamps: worldLamps,
      fill,
    };
  } catch (error) {
    releaseCandidate(group);
    throw error;
  }
}
export function composeSequence(
  pair: CameraPair,
  node: SequenceScene,
  time: number,
  composition?: { first: ShotView; overhead: ShotView },
): CameraPair {
  const u = phaseAt(node.sequence, time),
    reveal = revealAt(node.sequence, time);
  const score = node.sequence.composition?.score;
  const frame = score
    ? scoreFrame(score, time - node.sequence.start)
    : undefined;
  const attention = frame?.attention ?? reveal;
  const focus = node.focus.clone();
  if (composition) focus.fromArray(composition.first.target);
  // The same subject is disclosed by gaze, never by replacing or moving its mesh.
  if (score?.technique === "lift")
    focus.y = T.MathUtils.lerp(node.group.position.y + 0.8, focus.y, reveal);
  const first = pair.first,
    overhead = pair.overhead;
  const framing = node.sequence.composition?.framing;
  if (framing) {
    const desiredFov = framingPolicy[framing].firstFov;
    first.fov = T.MathUtils.lerp(first.fov, desiredFov, reveal);
    if (score?.technique === "open")
      first.fov = T.MathUtils.lerp(
        first.fov,
        Math.max(32, desiredFov - 15),
        attention * (1 - reveal),
      );
  }
  if (node.sequence.kind === "tavern") {
    const angle = Math.sin(smooth((u - 0.32) / 0.36) * Math.PI * 2) * 0.65;
    const dir = new T.Vector3(
      Math.sin(node.heading + angle + 0.75),
      0,
      Math.cos(node.heading + angle + 0.75),
    );
    focus.fromArray(first.position).addScaledVector(dir, 5);
    focus.y = 1.9;
  }
  if (node.sequence.composition) {
    // Blend gaze directions, not target positions: an 18-unit travel target
    // otherwise overwhelms a nearby indoor focus even at 92% reveal.
    const eye = new T.Vector3().fromArray(first.position),
      travel = new T.Vector3().fromArray(first.target).sub(eye),
      desired = focus.clone().sub(eye),
      distance = T.MathUtils.lerp(travel.length(), desired.length(), attention);
    if (travel.lengthSq() > 1e-8 && desired.lengthSq() > 1e-8) {
      travel.normalize();
      desired.normalize();
      const rotation = new T.Quaternion().setFromUnitVectors(travel, desired);
      rotation.slerpQuaternions(
        new T.Quaternion(),
        rotation.clone(),
        attention,
      );
      first.target = eye
        .add(travel.applyQuaternion(rotation).multiplyScalar(distance))
        .toArray();
    } else first.target = focus.toArray();
  } else {
    first.target = new T.Vector3()
      .fromArray(first.target)
      .lerp(focus, reveal)
      .toArray();
  }
  if (node.sequence.composition?.gaze === "survey") {
    const eye = new T.Vector3().fromArray(first.position),
      target = new T.Vector3().fromArray(first.target);
    const direction = target.sub(eye);
    direction.applyAxisAngle(
      new T.Vector3(0, 1, 0),
      Math.sin(
        (frame ? frame.holdProgress : smooth((u - 0.3) / 0.4)) * Math.PI * 2,
      ) *
        0.12 *
        reveal,
    );
    first.target = eye.add(direction).toArray();
  }
  const mid = node.anchor.clone().lerp(node.focus, 0.33);
  mid.y = 5;
  if (composition) mid.fromArray(composition.overhead.target);
  overhead.target = new T.Vector3()
    .fromArray(overhead.target)
    .lerp(mid, reveal)
    .toArray();
  const panorama = node.group.localToWorld(
    node.sequence.kind === "tavern"
      ? new T.Vector3(-9, 17, -10)
      : new T.Vector3(-27, 40, -23),
  );
  if (composition) panorama.fromArray(composition.overhead.position);
  overhead.position = new T.Vector3()
    .fromArray(overhead.position)
    .lerp(panorama, reveal)
    .toArray();
  if (composition) {
    first.fov = T.MathUtils.lerp(first.fov, composition.first.fov, reveal);
    overhead.fov = T.MathUtils.lerp(
      overhead.fov,
      composition.overhead.fov,
      reveal,
    );
  }
  return pair;
}
