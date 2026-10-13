import { object, text, number, array, choice } from "./creative-validation";
import type { Traversal } from "./traversal";
import { validateCinematicScore, type CinematicScore } from "./cinematic-score";
import {
  validateCommitments,
  validateCommitmentBindings,
  type CreativeCommitment,
  type CommitmentBinding,
} from "./creative-commitments";
export interface CinematicScene {
  entityId?: string;
  score?: CinematicScore;
  commitments?: CreativeCommitment[];
  bindings?: CommitmentBinding[];
  traversal?: Traversal;
  version: 1;
  title: string;
  framing?: "intimate" | "hero" | "vista";
  objects: {
    assetId: string;
    role: "primary" | "secondary" | "foreground" | "backdrop";
    position: [number, number, number];
    scale: number;
    rotation?: number;
  }[];
  hold: number;
  gaze: "focus" | "survey";
  fill: string;
  firstIntent: string;
  overheadIntent: string;
}
export function validateCinematicScene(
  raw: unknown,
  available: readonly string[],
): CinematicScene {
  const s = object(raw);
  if (s.version !== 1) throw Error("场景编排版本无效");
  const objects = array(s.objects, "场景对象", 1, 7).map((raw) => {
    const o = object(raw),
      assetId = text(o.assetId, "对象资产", 64);
    if (!available.includes(assetId))
      throw Error(`场景缺少资产版本 ${assetId}`);
    return {
      assetId,
      role: choice(
        o.role,
        ["primary", "secondary", "foreground", "backdrop"] as const,
        "对象角色",
      ),
      position: array(o.position, "对象位置", 3, 3).map((x, i) =>
        number(x, "位置", i === 1 ? -1 : -65, 65),
      ) as [number, number, number],
      scale: number(o.scale, "对象尺度", 0.3, 3),
      ...(o.rotation !== undefined
        ? {
            rotation: number(o.rotation, "对象朝向", -Math.PI * 2, Math.PI * 2),
          }
        : {}),
    };
  });
  if (objects.filter((o) => o.role === "primary").length !== 1)
    throw Error("编排必须有一个主要主体");
  const fill = text(s.fill, "补光颜色", 7);
  if (!/^#[0-9a-f]{6}$/i.test(fill)) throw Error("补光颜色无效");
  let traversal: Traversal | undefined;
  if (s.traversal !== undefined) {
    const t = object(s.traversal),
      passage = object(t.passage);
    const objectIndex = number(
      t.objectIndex,
      "通行对象",
      0,
      objects.length - 1,
    );
    if (
      !Number.isInteger(objectIndex) ||
      objects[objectIndex].role !== "primary"
    )
      throw Error("通行必须绑定主要空间组件");
    const lateral = number(t.lateral, "侧向通道", -24, 24);
    if (
      Math.abs(lateral) < 8 ||
      objects[objectIndex].scale !== 1 ||
      objects[objectIndex].rotation !== 0 ||
      objects[objectIndex].position.some(
        (v, i) => v !== (i === 0 ? lateral : 0),
      )
    )
      throw Error("通行空间必须与共享路线坐标一致");
    if (typeof passage.sheltered !== "boolean") throw Error("遮雨能力无效");
    traversal = {
      objectIndex,
      lateral,
      passage: {
        halfLength: number(passage.halfLength, "通道半长", 2, 12),
        width: number(passage.width, "通道宽度", 1.5, 12),
        height: number(passage.height, "通道高度", 2, 12),
        focus: array(passage.focus, "室内观察点", 3, 3).map((v) =>
          number(v, "观察坐标", -20, 20),
        ) as [number, number, number],
        ...(passage.focusAsset
          ? { focusAsset: text(passage.focusAsset, "观察部件", 64) }
          : {}),
        ...(passage.focusPart
          ? { focusPart: text(passage.focusPart, "观察几何部件", 64) }
          : {}),
        sheltered: passage.sheltered,
      },
    };
  }
  return {
    version: 1,
    ...(s.entityId !== undefined
      ? { entityId: text(s.entityId, "实体身份", 120) }
      : {}),
    ...(s.score ? { score: validateCinematicScore(s.score) } : {}),
    ...(s.commitments
      ? {
          commitments: validateCommitments(s.commitments),
          bindings: validateCommitmentBindings(
            s.bindings,
            validateCommitments(s.commitments),
            objects.length,
          ),
        }
      : {}),
    title: text(s.title, "场景标题", 80),
    ...(s.framing !== undefined
      ? {
          framing: choice(
            s.framing,
            ["intimate", "hero", "vista"] as const,
            "景别",
          ),
        }
      : {}),
    objects,
    ...(traversal ? { traversal } : {}),
    hold: number(s.hold, "驻足比例", 0.1, 0.4),
    gaze: choice(s.gaze, ["focus", "survey"] as const, "观赏方式"),
    fill,
    firstIntent: text(s.firstIntent, "第一视角", 250),
    overheadIntent: text(s.overheadIntent, "俯视", 250),
  };
}
