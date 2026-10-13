import {
  validateFeatures,
  validateExcludedFeatures,
  type ComponentFeature,
} from "./component-features";
import type { CreativeBrief } from "./creative-brief";
import { validateCinematicScore, type CinematicScore } from "./cinematic-score";
import {
  validateCommitments,
  validateCommitmentBindings,
  type CreativeCommitment,
  type CommitmentBinding,
} from "./creative-commitments";
import {
  contentId,
  journeyStyle,
  resolveEntry,
  type LibraryEntry,
  type CreativeLibrary,
  type LibraryRef,
  type WorldFacet,
  type SceneRecipe,
  type AtmosphereRecipe,
  type ComponentRecipe,
} from "./creative-library";
import {
  object,
  text,
  number,
  array,
  choice,
  facets,
  sceneRecipe,
  atmosphereRecipe,
  componentRecipe,
} from "./creative-validation";

export interface GrowthRequest<T> {
  name: string;
  reason: string;
  recipe: T;
}
export type ContentChoice<T> =
  | { reuse: LibraryRef; create?: never }
  | { create: GrowthRequest<T>; reuse?: never };
export interface CreativeObject {
  content: ContentChoice<ComponentRecipe>;
  role: "primary" | "secondary" | "foreground" | "backdrop";
  position: [number, number, number];
  scale: number;
}
export interface CinematicMoment {
  entityId?: string;
  score?: CinematicScore;
  commitments?: CreativeCommitment[];
  bindings?: CommitmentBinding[];
  id: string;
  beatId: string;
  start: number;
  end: number;
  title: string;
  story: string;
  metaphor: string;
  evidence: string;
  lyricIds?: number[];
  uncertainty: string;
  approach: string;
  aftermath: string;
  atmosphere: ContentChoice<AtmosphereRecipe>;
  objects: CreativeObject[];
  action: {
    hold: number;
    gaze: "focus" | "survey";
    transition: number;
    experience?: "observe" | "passage";
  };
  views: { first: string; overhead: string };
  requiredFeatures?: ComponentFeature[];
  framing?: "intimate" | "hero" | "vista";
}
export interface CreativeCandidate {
  reviewNotes?: string[];
  version: 1;
  id: string;
  title: string;
  thesis: string;
  difference: string;
  world: {
    needs: WorldFacet[];
    excludedFeatures?: ComponentFeature[];
    reason: string;
    create?: GrowthRequest<SceneRecipe>;
  };
  moments: CinematicMoment[];
  gaps: string[];
}
export interface CreativeContext {
  directorVersion?: 1 | 2;
  version: 1;
  task: "creative";
  brief: CreativeBrief;
  library: CreativeLibrary;
  style: typeof journeyStyle;
  allowGrowth: boolean;
  ordinal: number;
  previous: {
    title: string;
    thesis: string;
    difference: string;
    moments?: {
      beatId: string;
      subject: string;
      metaphor: string;
      story?: string;
      technique?: CinematicScore["technique"];
      stages?: string[];
    }[];
  }[];
  correction: string;
  repair?: {
    previous: unknown;
    error: string;
    scope?: "intent" | "production";
  };
}
export interface CreativeProvider {
  create(context: CreativeContext, signal: AbortSignal): Promise<unknown>;
}
export interface CreativeSession {
  generationFailures?: { ordinal: number; reason: string }[];
  version: 1;
  source: { inputKey: string; binding: string; revision: string };
  contextId: string;
  correction: string;
  candidates: CreativeCandidate[];
  originalResponses: unknown[];
  provider: string;
  /** Complete evidence/library snapshot makes a saved run reproducible after library growth. */
  context?: Pick<
    CreativeContext,
    "brief" | "library" | "style" | "allowGrowth" | "directorVersion"
  >;
}
const ref = (raw: unknown): LibraryRef => {
  const r = object(raw);
  const version = number(r.version, "引用版本", 1, 9999);
  if (!Number.isInteger(version)) throw Error("引用版本须为整数");
  return { id: text(r.id, "引用标识", 64), version };
};
function content<T>(
  raw: unknown,
  layer: LibraryEntry["layer"],
  library: CreativeLibrary,
  parse: (x: unknown) => T,
): ContentChoice<T> {
  const c = object(raw);
  if (Boolean(c.reuse) === Boolean(c.create))
    throw Error("请选择复用或生成，不能同时指定");
  if (c.reuse) {
    const r = ref(c.reuse),
      entry = resolveEntry(library, r);
    if (entry.layer !== layer) throw Error("引用了错误的库层级");
    return { reuse: r };
  }
  const request = object(c.create);
  return {
    create: {
      name: text(request.name, "新设计名称", 60),
      reason: text(request.reason, "新增理由", 400),
      recipe: parse(request.recipe),
    },
  };
}
/** Validate model output against its exact evidence windows and immutable library snapshot. */
export function validateCreativeCandidate(
  raw: unknown,
  context: CreativeContext,
): CreativeCandidate {
  const envelope = object(raw, "创作候选");
  if (envelope.failure) {
    const failure = object(envelope.failure);
    throw Error(
      `模型创作${typeof failure.phase === "string" ? failure.phase : ""}失败：${text(failure.message, "失败原因", 300)}`,
    );
  }
  const c = object(envelope.candidate ?? envelope, "创作候选"),
    world = object(c.world, "世界选择");
  if (c.version !== 1) throw Error("创作候选版本不支持");
  const moments = array(c.moments, "重点桥段", 0, 2)
    .map((v, index): CinematicMoment => {
      const m = object(v),
        beatId = text(m.beatId, "分段引用", 50),
        beat = context.brief.beats.find((b) => b.id === beatId);
      if (!beat) throw Error("桥段引用了不存在的分析时间窗");
      if (beat.direction.locked) throw Error("创作不得覆盖已经锁定的分析段落");
      const lyricIds =
        m.lyricIds === undefined
          ? undefined
          : array(m.lyricIds, "歌词引用", 0, 20).map((id) =>
              number(id, "歌词编号", 1, 100000),
            );
      const localLyrics = beat.evidence?.lyrics ?? beat.citedLyrics;
      if (
        lyricIds?.some(
          (id) =>
            !Number.isInteger(id) ||
            !localLyrics.some((line) => line.id === id),
        )
      )
        throw Error("创作引用了当前时段之外的歌词");
      const duration = context.brief.beats.at(-1)?.end ?? 0;
      const start = number(m.start, "桥段开始", 0, duration),
        end = number(m.end, "桥段结束", 0, duration);
      if (
        end - start < 12 ||
        end - start > 40 ||
        end <= beat.start ||
        start >= beat.end
      )
        throw Error("桥段时长或证据时间窗不匹配");
      if (
        context.brief.beats.some(
          (b) => b.direction.locked && start < b.end && end > b.start,
        )
      )
        throw Error("桥段范围跨越锁定段落");
      const objectList = Array.isArray(m.objects)
        ? m.objects
        : (() => {
            const group = object(m.objects, "构图层次");
            return [
              { ...object(group.primary, "主视觉主体"), role: "primary" },
              ...array(group.supporting, "配景", 0, 6).map((value) => {
                const item = object(value);
                if (item.role === "primary")
                  throw Error("配景不能冒充第二个主要主体");
                return item;
              }),
            ];
          })();
      const objects = array(
        objectList,
        "画面主体",
        m.commitments ? 0 : 1,
        7,
      ).map((v) => {
        const o = object(v),
          p = array(o.position, "主体位置", 3, 3).map((n, i) =>
            number(n, "主体位置", i === 1 ? -1 : -65, 65),
          ) as [number, number, number];
        return {
          content: content(
            o.content,
            "component",
            context.library,
            componentRecipe,
          ),
          role: choice(
            o.role,
            ["primary", "secondary", "foreground", "backdrop"] as const,
            "画面角色",
          ),
          position: p,
          scale: number(o.scale, "主体尺度", 0.3, 3),
        };
      });
      if (
        objects.length &&
        objects.filter((o) => o.role === "primary").length !== 1
      )
        throw Error("每个高潮需要且只能有一个主要视觉主体");
      if (m.commitments && objects.length && objects[0].role !== "primary")
        throw Error("画面承诺的零号载体必须是主要主体");
      const action = object(m.action),
        views = object(m.views);
      if (
        context.directorVersion !== undefined &&
        (!m.score || !m.commitments || !m.bindings)
      )
        throw Error("新导演结果缺少五阶段时序或必要画面绑定");
      const entityId =
        m.entityId === undefined ? undefined : text(m.entityId, "世界实体", 60);
      if (
        (context.directorVersion === 2 && !entityId) ||
        (entityId && !/^[a-z][a-z0-9-]*$/.test(entityId))
      )
        throw Error("新导演结果必须明确主体的世界实体身份");
      const score = m.score ? validateCinematicScore(m.score) : undefined;
      if (
        score &&
        (Math.abs(score.stages[4].end - (end - start)) > 0.001 ||
          Math.abs(start + score.stages[3].start - score.anchor.time) > 0.001)
      )
        throw Error("导演时序与桥段或揭示锚点不一致");
      const commitments = m.commitments
        ? validateCommitments(m.commitments)
        : undefined;
      const bindings = commitments
        ? validateCommitmentBindings(m.bindings, commitments, objects.length)
        : undefined;
      return {
        ...(entityId ? { entityId } : {}),
        ...(score ? { score } : {}),
        ...(commitments ? { commitments, bindings } : {}),
        id: `moment-${index}`,
        beatId,
        start,
        end,
        title: text(m.title, "桥段名称", 80),
        ...(m.requiredFeatures !== undefined
          ? { requiredFeatures: validateFeatures(m.requiredFeatures) }
          : {}),
        story: text(m.story, "叙事作用", 400),
        metaphor: text(m.metaphor, "视觉表达", 300),
        evidence: text(m.evidence, "证据说明", 400),
        ...(lyricIds ? { lyricIds: [...new Set(lyricIds)] } : {}),
        uncertainty:
          typeof m.uncertainty === "string" ? m.uncertainty.slice(0, 400) : "",
        approach: text(m.approach, "铺垫", 250),
        aftermath: text(m.aftermath, "余韵", 250),
        atmosphere: content(
          m.atmosphere,
          "atmosphere",
          context.library,
          atmosphereRecipe,
        ),
        objects,
        action: {
          hold: number(action.hold, "驻足比例", 0.1, 0.4),
          gaze: choice(action.gaze, ["focus", "survey"] as const, "观看动作"),
          transition: number(action.transition, "光影渐变", 2, 15),
          ...(action.experience !== undefined
            ? {
                experience: choice(
                  action.experience,
                  ["observe", "passage"] as const,
                  "空间动作",
                ),
              }
            : {}),
        },
        views: {
          first: text(views.first, "第一视角意图", 250),
          overhead: text(views.overhead, "俯视意图", 250),
        },
        ...(m.framing !== undefined
          ? {
              framing: choice(
                m.framing,
                ["intimate", "hero", "vista"] as const,
                "景别",
              ),
            }
          : {}),
      };
    })
    .sort((a, b) => a.start - b.start);
  if (moments.some((m, i) => i > 0 && m.start < moments[i - 1].end + 2))
    throw Error("重点桥段重叠或缺少衔接空间");
  let newWorld: GrowthRequest<SceneRecipe> | undefined;
  if (world.create) {
    const w = object(world.create);
    newWorld = {
      name: text(w.name, "新场景名称", 60),
      reason: text(w.reason, "新场景理由", 400),
      recipe: sceneRecipe(w.recipe),
    };
  }
  const grounding = envelope.grounding
    ? object(envelope.grounding, "模型核对")
    : undefined;
  const candidate: CreativeCandidate = {
    version: 1,
    id: "",
    ...(grounding?.mode === "advisory"
      ? {
          reviewNotes: array(grounding.issues, "模型核对提示", 0, 6).map(
            (value) => {
              const issue = object(value);
              return `${text(issue.beatId, "核对时段", 50)}：${text(issue.reason, "核对提示", 250)}`;
            },
          ),
        }
      : {}),
    title: text(c.title, "创作名称", 80),
    thesis: text(c.thesis, "创作主旨", 400),
    difference: text(c.difference, "候选差异", 300),
    world: {
      needs: facets(world.needs),
      ...(world.excludedFeatures !== undefined
        ? { excludedFeatures: validateExcludedFeatures(world.excludedFeatures) }
        : {}),
      reason: text(world.reason, "场景选择理由", 400),
      ...(newWorld ? { create: newWorld } : {}),
    },
    moments,
    gaps: array(c.gaps ?? [], "能力缺口", 0, 8).map((x) =>
      text(x, "能力缺口", 200),
    ),
  };
  if (
    !context.allowGrowth &&
    (newWorld ||
      moments.some(
        (m) => m.atmosphere.create || m.objects.some((o) => o.content.create),
      ))
  )
    throw Error("生长关闭时只能复用已有库条目");
  candidate.id = `direction-${contentId(candidate)}`;
  return candidate;
}
