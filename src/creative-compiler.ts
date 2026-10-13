import { chapterAt, validatePlan, type Plan, type Asset } from "./model";
import { resolveEntry, type LibraryEntry } from "./domain/creative-library";
import type { CreativeResolution } from "./domain/creative-resolution";
import { generateComponent } from "./domain/creative-generators";
import type { Sequence } from "./sequences";
import {
  inputKey,
  audioBinding,
  narrativeRevision,
} from "./domain/narrative-contract";
import type { CreativeSession } from "./domain/creative-contract";
import { componentPassage } from "./domain/component-capabilities";
import { observerSpace } from "./domain/observer-space";
import { creativeWeather } from "./domain/creative-weather";

/** Compiles declarative direction to a portable Plan. No renderer, provider or storage. */
export function compileCreativePlan(
  source: Plan,
  resolution: CreativeResolution,
  binding: CreativeSession["source"],
): Plan {
  if (resolution.status !== "ready") throw Error("创作仍有未解决的能力缺口");
  if (
    inputKey(source) !== binding.inputKey ||
    audioBinding(source) !== binding.binding ||
    !source.narrative ||
    narrativeRevision(source.narrative) !== binding.revision
  )
    throw Error("创作依据已经过期，不能覆盖当前旅程");
  const p = structuredClone(source),
    world = resolveEntry(resolution.library, resolution.scene);
  if (world.layer !== "scene") throw Error("场景库引用无效");
  const worldRecipe = resolution.sceneRecipe ?? world.recipe;
  if (
    source.narrative!.segments.some((s) => s.locked) &&
    (source.creativeWorld?.ref.id !== resolution.scene.id ||
      source.creativeWorld?.ref.version !== resolution.scene.version)
  )
    throw Error(
      "存在人工锁定段，不能用全局场景切换覆盖它；请保留当前世界或解除相关锁定。",
    );
  const factories = new Map<string, string>();
  const component = (entry: LibraryEntry) => {
    if (entry.layer !== "component") throw Error("组件库引用无效");
    if (entry.recipe.generator === "existing") return entry.recipe.assetId;
    if (factories.has(entry.id)) return factories.get(entry.id)!;
    const recipe = generateComponent(entry)!;
    const old = p.library.find((r) => r.id === recipe.id);
    if (old && JSON.stringify(old) !== JSON.stringify(recipe))
      throw Error("计划包含不一致的资产版本");
    if (!old) p.library.push(recipe);
    factories.set(entry.id, recipe.id);
    return recipe.id;
  };
  const oldChapters = structuredClone(p.chapters),
    locks = p.narrative!.segments.filter((s) => s.locked);
  const locked = (time: number) =>
    locks.some((s) => time >= s.start && time < s.end);
  const baseTheme =
    worldRecipe.terrain === "waterfront"
      ? "river"
      : worldRecipe.terrain === "highland"
        ? "ridge"
        : "shade";
  const worldDecorations = (worldRecipe.decorations ?? []).map((ref) =>
    component(resolveEntry(resolution.library, ref)),
  );
  p.chapters = p.chapters.map((c) =>
    locked(c.start)
      ? c
      : {
          ...c,
          theme: baseTheme,
          assets: worldRecipe.components as Asset[],
          recipes: worldDecorations,
          source: "rule",
        },
  );
  // World rules are data, distinct from lighting and scene arrangement.
  p.creativeWorld = {
    version: 1,
    ref: resolution.scene,
    recipe: structuredClone(worldRecipe),
    candidate: resolution.candidate.id,
    name: world.name,
    title: resolution.candidate.title,
  };
  const sequences: Sequence[] = [];
  for (const moment of resolution.moments) {
    const m = moment.direction,
      atmosphere = resolveEntry(resolution.library, moment.atmosphere);
    if (atmosphere.layer !== "atmosphere") throw Error("氛围引用无效");
    const primaryIndex = moment.objects.findIndex((o) => o.role === "primary");
    const passage =
      m.action.experience === "passage"
        ? componentPassage(
            resolveEntry(resolution.library, moment.objects[primaryIndex].ref),
          )
        : undefined;
    if (m.action.experience === "passage" && !passage)
      throw Error("所选组件未声明可穿行空间，请选择路边观察");
    const body = observerSpace(p.visual.observerScale).travelEnvelope;
    if (
      passage &&
      (passage.width < body.radius * 2 + 0.2 ||
        passage.height < body.height + 0.2)
    )
      throw Error("当前观察者尺度无法安全通过所选空间");
    const lateral = moment.objects[primaryIndex].position[0] < 0 ? -12 : 12;
    const atmosphereId = atmosphere.id;
    if (!p.atmospheres.some((a) => a.id === atmosphereId))
      p.atmospheres.push({
        id: atmosphereId,
        name: atmosphere.name,
        ...atmosphere.recipe.lighting,
      });
    const span = m.end - m.start,
      start = m.start + (m.score?.stages[1].start ?? span * 0.1);
    const base = structuredClone(
      chapterAt({ ...p, chapters: oldChapters }, start),
    );
    const endChapter = structuredClone(
      chapterAt({ ...p, chapters: oldChapters }, m.end),
    );
    const cue = (chapter: typeof base, at: number): typeof base => ({
      ...chapter,
      start: at,
      title: m.title,
      theme: baseTheme,
      assets: worldRecipe.components as Asset[],
      recipes: worldDecorations,
      atmosphere: atmosphereId,
      source: "rule" as const,
      director: {
        view: "first" as const,
        transition: m.score
          ? m.score.stages[2].end - m.score.stages[1].start
          : m.action.transition,
      },
      weather: creativeWeather(chapter.weather, atmosphere.recipe, m.evidence),
    });
    // A lighting cue must not erase rain/after-rain changes inside its window.
    // Keep every original event boundary and inherit that event's weather.
    p.chapters = p.chapters.map((c) =>
      c.start >= start && c.start < m.end ? cue(c, c.start) : c,
    );
    if (!p.chapters.some((c) => c.start === start))
      p.chapters.push(cue(base, start));
    if (
      m.end < p.audio.clipEnd - p.audio.clipStart &&
      !p.chapters.some((c) => c.start === m.end)
    )
      p.chapters.push({
        ...endChapter,
        start: m.end,
        theme: baseTheme,
        assets: worldRecipe.components as Asset[],
        recipes: worldDecorations,
        director: { view: "follow", transition: m.action.transition },
      });
    sequences.push({
      id: `cinema-${resolution.candidate.id}-${m.id}`,
      kind: "composition",
      focus: "lantern",
      start: m.start,
      end: m.end,
      reason: m.story,
      source: "semantic",
      lyricIds: m.lyricIds ?? [],
      composition: {
        version: 1,
        ...(m.entityId
          ? { entityId: `${resolution.candidate.id}/${m.entityId}` }
          : {}),
        ...(m.score ? { score: structuredClone(m.score) } : {}),
        ...(m.commitments
          ? {
              commitments: structuredClone(m.commitments),
              bindings: structuredClone(m.bindings),
            }
          : {}),
        title: m.title,
        ...(m.framing ? { framing: m.framing } : {}),
        objects: moment.objects.map((o, i) => ({
          assetId: component(resolveEntry(resolution.library, o.ref)),
          role: o.role,
          position:
            passage && i === primaryIndex ? [lateral, 0, 0] : o.position,
          scale: passage && i === primaryIndex ? 1 : o.scale,
          rotation:
            passage && i === primaryIndex
              ? 0
              : Math.atan2(-o.position[0], -o.position[2]),
        })),
        ...(passage
          ? { traversal: { objectIndex: primaryIndex, lateral, passage } }
          : {}),
        hold: m.action.hold,
        gaze: m.action.gaze,
        fill: atmosphere.recipe.lighting.accent,
        firstIntent: m.views.first,
        overheadIntent: m.views.overhead,
      },
    });
  }
  // Locked old bridge passages remain immutable; new moments were checked not to overlap locks.
  p.sequences = [
    ...(source.sequences ?? []).filter((s) =>
      locks.some((l) => s.start < l.end && s.end > l.start),
    ),
    ...sequences,
  ].sort((a, b) => a.start - b.start);
  p.chapters.sort((a, b) => a.start - b.start);
  p.features = { ...p.features, sequences: true };
  return validatePlan(p);
}
