import {
  componentFeatures,
  featureDescriptions,
  supportsFeatures,
} from "./component-features";
import {
  chooseScene,
  contentId,
  journeyStyle,
  registerEntries,
  resolveEntry,
  type LibraryEntry,
  type CreativeLibrary,
  type LibraryRef,
  type SceneDecision,
  type SceneRecipe,
} from "./creative-library";
import type {
  CreativeCandidate,
  ContentChoice,
  CinematicMoment,
} from "./creative-contract";
import { validateLibrary } from "./creative-validation";
import { nearDuplicate } from "./creative-novelty";
import {
  componentPassage,
  canScatterComponent,
} from "./component-capabilities";
import { constrainScene, sceneExclusions } from "./scene-selection";
import {
  observerCapabilities,
  lightingCapabilities,
} from "./creative-commitments";

export interface ResolvedMoment {
  direction: CinematicMoment;
  atmosphere: LibraryRef;
  objects: {
    ref: LibraryRef;
    role: CinematicMoment["objects"][number]["role"];
    position: [number, number, number];
    scale: number;
  }[];
}
export interface CreativeResolution {
  version: 1;
  candidate: CreativeCandidate;
  library: CreativeLibrary;
  scene: LibraryRef;
  sceneDecision: SceneDecision;
  sceneRecipe?: SceneRecipe;
  moments: ResolvedMoment[];
  additions: LibraryEntry[];
  reused: LibraryRef[];
  gaps: string[];
  notices: string[];
  status: "ready" | "blocked";
  repairScope?: "intent" | "production";
}
const sceneryAssets = new Set([
  "tree",
  "flowerTree",
  "shop",
  "home",
  "tower",
  "lamp",
  "bus",
  "person",
  "bench",
  "stop",
]);
/** Resolves capabilities without mutating storage or invoking a renderer.
 * Semantic coverage and structural feasibility are separate checks. */
export function resolveCreative(
  candidate: CreativeCandidate,
  library: CreativeLibrary,
  source: string,
  allowGrowth = true,
): CreativeResolution {
  let working = structuredClone(library);
  const additions: LibraryEntry[] = [],
    reused: LibraryRef[] = [],
    gaps = [...candidate.gaps],
    notices: string[] = [];
  const decision = chooseScene(
    candidate.world.needs,
    working,
    allowGrowth,
    candidate.world.excludedFeatures,
  );
  let scene = decision.selected ?? decision.ranking[0]?.ref;
  const counts = { scene: 0, atmosphere: 0, component: 0 };
  let repairScope: "intent" | "production" = "production";
  function materialize<T>(
    value: ContentChoice<T>,
    layer: LibraryEntry["layer"],
  ): LibraryRef {
    if (value.reuse) {
      const e = resolveEntry(working, value.reuse);
      if (e.layer !== layer) throw Error("内容层级不匹配");
      reused.push(value.reuse);
      return value.reuse;
    }
    if (!allowGrowth) throw Error("生长开关已经关闭");
    const request = value.create;
    const entry = {
      id: `grown-${layer}-${contentId({ layer, recipe: request.recipe, style: journeyStyle.id })}`,
      version: 1,
      layer,
      name: request.name,
      description: request.reason,
      tags: [],
      styleId: journeyStyle.id,
      state: "technical-preview",
      origin: "generated",
      recipe: request.recipe,
      provenance: {
        source,
        candidate: candidate.id,
        generatorVersion: "creative-generators-v1",
      },
    } as LibraryEntry;
    const valid = validateLibrary({ version: 1, entries: [entry] }).entries[0];
    valid.provenance.generatorVersion =
      valid.layer === "component"
        ? `${valid.recipe.generator}-v${"revision" in valid.recipe ? (valid.recipe.revision ?? 1) : 1}`
        : `${valid.layer}-recipe-v1`;
    if (valid.layer === "component" && valid.recipe.generator === "existing")
      throw Error("引用已有组件必须通过复用路径，不能登记为新生成");
    const similar = nearDuplicate(valid, working);
    if (similar)
      throw Error(
        `新增${layer}与「${similar.name}」结构或光影差异不足，请复用 ${similar.id}@${similar.version}；换名、换种子或微小调色不能独立入库`,
      );
    const result = registerEntries(working, [valid]),
      ref = result.refs[0];
    if (result.library.entries.length === working.entries.length) {
      reused.push(ref);
      notices.push(`已有相同配方，复用 ${ref.id}`);
    } else {
      counts[layer]++;
      if (counts[layer] > 1)
        throw Error(`本曲${layer}新增预算最多一项，请合并设计或复用`);
      additions.push(valid);
    }
    working = result.library;
    return ref;
  }
  if (candidate.world.create) {
    if (!decision.growth.eligible) {
      notices.push("新场景未达到新增门槛，继续复用已有场景；提案保留供审阅");
    } else {
      const recipe: SceneRecipe = candidate.world.create.recipe;
      const missingFactories = recipe.components.filter(
        (id) => !sceneryAssets.has(id),
      );
      if (missingFactories.length)
        gaps.push(`新场景缺少沿路生成能力：${missingFactories.join("、")}`);
      else {
        const proposed: LibraryEntry = {
          id: "proposed",
          version: 1,
          layer: "scene",
          name: candidate.world.create.name,
          description: candidate.world.create.reason,
          tags: [],
          styleId: journeyStyle.id,
          state: "technical-preview",
          origin: "generated",
          recipe,
          provenance: {
            source,
            candidate: candidate.id,
            generatorVersion: "1",
          },
        };
        const coverage = chooseScene(
          candidate.world.needs,
          {
            version: 1,
            entries: [
              proposed,
              ...working.entries.filter((e) => e.layer === "component"),
            ],
          },
          false,
          candidate.world.excludedFeatures,
        ).ranking[0].fit;
        const top = decision.ranking[0]?.fit ?? 0;
        if (coverage < 0.8 || coverage - top < 0.25) {
          repairScope = "intent";
          gaps.push("新场景没有充分覆盖重要空间需求，或相比已有场景改善不足");
        } else if (new Set(recipe.futureUses.map((x) => x.trim())).size < 2)
          gaps.push("新场景缺少至少两种不同的未来用途");
        else scene = materialize({ create: candidate.world.create }, "scene");
      }
    }
  } else if (
    decision.growth.eligible ||
    (!allowGrowth &&
      (decision.ranking[0]?.fit ?? 0) < 0.55 &&
      decision.ranking[0]?.missing.some((n) => n.importance === "essential"))
  ) {
    repairScope = "intent";
    gaps.push(
      allowGrowth
        ? "已有场景覆盖不足：需要新场景提案或明确调整空间需求"
        : "生长已关闭且已有场景缺少必要空间要素，请调整需求或开启生长；不能把复用标记成完整覆盖",
    );
  }
  if (!scene) throw Error("没有可用场景");
  const worldEntry = resolveEntry(working, scene);
  if (worldEntry.layer !== "scene") throw Error("世界引用无效");
  const selectedScore = chooseScene(
    candidate.world.needs,
    {
      version: 1,
      entries: [
        worldEntry,
        ...working.entries.filter((e) => e.layer === "component"),
      ],
    },
    false,
    candidate.world.excludedFeatures,
  ).ranking[0];
  if (selectedScore?.identityConflict) {
    repairScope = "intent";
    gaps.push(
      `场景的空间特征与明确排除的内容冲突：${selectedScore.conflicts?.map((f) => featureDescriptions[f]).join("、")}`,
    );
  }
  const sceneRecipe = constrainScene(
    worldEntry.recipe,
    working,
    candidate.world.excludedFeatures,
    candidate.world.needs,
  );
  if (selectedScore?.conflicts?.length && !selectedScore.identityConflict)
    notices.push(
      `保留「${worldEntry.name}」的空间规则，本次编排排除 ${selectedScore.conflicts.map((f) => featureDescriptions[f]).join("、")}，不因此新增场景。`,
    );
  for (const ref of sceneRecipe.decorations ?? []) {
    if (!canScatterComponent(resolveEntry(working, ref)))
      throw Error("场景引用了不能沿路放置的组件版本");
    reused.push(ref);
  }
  const moments = candidate.moments.map((direction) => ({
    direction: structuredClone(direction),
    atmosphere: materialize(direction.atmosphere, "atmosphere"),
    objects: direction.objects.map((o) => ({
      ref: materialize(o.content, "component"),
      role: o.role,
      position: [...o.position] as [number, number, number],
      scale: o.scale,
    })),
  }));
  const entities = new Map<string, (typeof moments)[number]>();
  for (const moment of moments) {
    if (moment.direction.entityId) {
      const owner = entities.get(moment.direction.entityId);
      if (owner) {
        const primary = (m: (typeof moments)[number]) =>
          m.objects.find((o) => o.role === "primary");
        if (
          owner.direction.action.experience === "passage" ||
          moment.direction.action.experience === "passage" ||
          JSON.stringify(primary(owner)) !== JSON.stringify(primary(moment)) ||
          moment.objects.length !== 1
        )
          gaps.push(
            "共享实体必须继承首次出现的主体形态与位置，不能新增配景或另一条通行路线",
          );
      } else entities.set(moment.direction.entityId, moment);
    }
    for (const claim of moment.direction.commitments ?? []) {
      const binding = moment.direction.bindings?.find(
        (b) => b.claimId === claim.id,
      );
      let supported = false;
      if (binding?.target === "component") {
        const object = moment.objects[binding.objectIndex];
        supported =
          !!object &&
          componentFeatures(resolveEntry(working, object.ref)).some(
            (f) => f === claim.capability,
          );
      } else if (binding?.target === "observer") {
        supported =
          !!moment.direction.score &&
          observerCapabilities.some(
            (capability) => capability === claim.capability,
          );
        if (claim.capability === "enter-exit")
          supported = moment.direction.action.experience === "passage";
      } else if (binding?.target === "lighting") {
        supported =
          lightingCapabilities.some(
            (capability) => capability === claim.capability,
          ) && !!moment.direction.score;
      }
      if (!supported) {
        const message = `「${claim.description}」尚未绑定可执行能力 ${claim.capability}；${binding?.reason ?? "没有执行绑定"}`;
        if (claim.essential) gaps.push(message);
        else notices.push(message);
      }
    }
    for (const object of moment.objects) {
      const actual = componentFeatures(resolveEntry(working, object.ref));
      const conflicts = sceneExclusions(
        candidate.world.needs,
        candidate.world.excludedFeatures,
      ).filter((f) => actual.includes(f));
      if (conflicts.length)
        gaps.push(
          `桥段「${moment.direction.title}」包含全曲明确排除的内容：${conflicts.map((f) => featureDescriptions[f]).join("、")}`,
        );
    }
    const primary = moment.objects.find((o) => o.role === "primary");
    if (!primary) {
      gaps.push(
        `「${moment.direction.title}」的主要主体尚无可执行载体，原始意图保留待实现`,
      );
      continue;
    }
    const entry = resolveEntry(working, primary.ref);
    if (
      moment.direction.requiredFeatures &&
      !supportsFeatures(
        componentFeatures(entry),
        moment.direction.requiredFeatures,
      )
    )
      gaps.push(
        `主要组件「${entry.name}」缺少已声明的可见能力：${moment.direction.requiredFeatures
          .filter((f) => !componentFeatures(entry).includes(f))
          .map((f) => featureDescriptions[f])
          .join("、")}`,
      );
    if (moment.direction.action.experience === "passage") {
      const primary = moment.objects.find((o) => o.role === "primary")!;
      if (!componentPassage(resolveEntry(working, primary.ref)))
        gaps.push("所选主要组件没有可穿行空间能力，请选择路边观察或其他组件");
    }
  }
  // Content identity excludes source IDs, so a later song reuses the same version.
  const primaryRefs = moments.flatMap((m) => {
    const ref = m.objects.find((o) => o.role === "primary")?.ref;
    return ref ? [`${ref.id}@${ref.version}`] : [];
  });
  if (
    new Set(primaryRefs).size < primaryRefs.length &&
    !moments.every(
      (m) =>
        m.direction.entityId &&
        m.direction.entityId === moments[0].direction.entityId,
    )
  )
    notices.push(
      "多个重点使用同一主体配方且身份不同，会沿路生成不同实体；请核对是否确实需要另一处地标。",
    );
  for (const m of moments)
    for (const object of m.objects) {
      const entry = resolveEntry(working, object.ref);
      if (
        entry.layer === "component" &&
        entry.recipe.generator === "existing"
      ) {
        const assetId = entry.recipe.assetId;
        if (
          !library.entries.some(
            (e) =>
              e.layer === "component" &&
              e.recipe.generator === "existing" &&
              e.recipe.assetId === assetId,
          )
        )
          gaps.push(`缺少已声明的组件工厂：${assetId}`);
      }
    }
  return {
    version: 1,
    candidate: structuredClone(candidate),
    library: working,
    scene,
    sceneDecision: decision,
    sceneRecipe,
    moments,
    additions,
    reused,
    gaps,
    notices,
    status: gaps.length ? "blocked" : "ready",
    ...(gaps.length ? { repairScope } : {}),
  };
}
