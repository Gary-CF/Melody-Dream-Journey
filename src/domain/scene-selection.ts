import type {
  LibraryRef,
  CreativeLibrary,
  WorldFacet,
  LibraryEntry,
  SceneRecipe,
} from "./creative-library";
import {
  componentFeatures,
  factoryFeatures,
  type ComponentFeature,
} from "./component-features";
const refKey = (r: LibraryRef) => r.id + "@" + r.version;
/** Identity-bearing spatial facts are distinct from removable decorations.
 * A forest needs trees; an optional street lamp never defines a new world. */
const coreFeatures: Record<string, ComponentFeature[]> = {
  "terrain:forest": ["woodland-tree"],
  "settlement:urban": ["roofed-building"],
};
export function constrainScene(
  recipe: SceneRecipe,
  library: CreativeLibrary,
  excluded: readonly ComponentFeature[] = [],
  needs: readonly WorldFacet[] = [],
) {
  excluded = sceneExclusions(needs, excluded);
  const result = structuredClone(recipe);
  result.components = result.components.filter(
    (id) => !factoryFeatures(id).some((f) => excluded.includes(f)),
  );
  if (excluded.includes("human-figure")) result.population = 0;
  if (result.decorations)
    result.decorations = result.decorations.filter((ref) => {
      const entry = library.entries.find((e) => refKey(e) === refKey(ref));
      return (
        !entry || !componentFeatures(entry).some((f) => excluded.includes(f))
      );
    });
  return result;
}
export function sceneExclusions(
  needs: readonly WorldFacet[],
  excluded: readonly ComponentFeature[] = [],
) {
  return [
    ...new Set([
      ...excluded,
      ...(needs.some(
        (n) =>
          n.axis === "settlement" &&
          n.value === "none" &&
          n.importance === "essential",
      )
        ? (["roofed-building", "human-figure"] as ComponentFeature[])
        : []),
    ]),
  ];
}
export interface SceneScore {
  ref: LibraryRef;
  name: string;
  fit: number;
  missing: WorldFacet[];
  matches: WorldFacet[];
  conflicts?: ComponentFeature[];
  identityConflict?: boolean;
}
export interface SceneDecision {
  policy: "reuse-first-v4";
  ranking: SceneScore[];
  selected?: LibraryRef;
  growth: { eligible: boolean; score: number; reason: string };
}
/** Deterministic evidence coverage, not a claimed artistic-quality measurement.
 * Weather/color are intentionally absent from WorldFacet: they cannot justify a new world. */
export function chooseScene(
  needs: WorldFacet[],
  library: CreativeLibrary,
  allowGrowth: boolean,
  excluded: readonly ComponentFeature[] = [],
): SceneDecision {
  excluded = sceneExclusions(needs, excluded);
  const weight = (n: WorldFacet) => (n.importance === "essential" ? 3 : 1);
  const total = needs.reduce((sum, n) => sum + weight(n), 0);
  const ranking = library.entries
    .filter(
      (e): e is LibraryEntry & { layer: "scene" } =>
        e.layer === "scene" && e.state !== "retired",
    )
    .map((entry) => {
      const visible = new Set(entry.recipe.components.flatMap(factoryFeatures));
      if (entry.recipe.population > 0) visible.add("human-figure");
      if (entry.recipe.terrain === "highland") visible.add("rock-landform");
      for (const ref of entry.recipe.decorations ?? []) {
        const component = library.entries.find(
          (e) => refKey(e) === refKey(ref),
        );
        if (component)
          componentFeatures(component).forEach((f) => visible.add(f));
      }
      const conflicts = excluded.filter((f) => visible.has(f));
      const adapted = constrainScene(entry.recipe, library, excluded, needs);
      const adaptedFeatures = adapted.components.flatMap(factoryFeatures);
      for (const ref of adapted.decorations ?? []) {
        const component = library.entries.find(
          (e) => refKey(e) === refKey(ref),
        );
        if (component) adaptedFeatures.push(...componentFeatures(component));
      }
      const identityConflict = entry.recipe.facets.some(
        (f) =>
          f.importance === "essential" &&
          coreFeatures[`${f.axis}:${f.value}`]?.some((feature) =>
            excluded.includes(feature),
          ),
      );
      const matches = needs.filter(
        (n) =>
          entry.recipe.facets.some(
            (f) => f.axis === n.axis && f.value === n.value,
          ) ||
          (n.axis === "terrain" && n.value === entry.recipe.terrain) ||
          (n.axis === "settlement" &&
            ["none", "wild"].includes(n.value) &&
            !adaptedFeatures.includes("roofed-building")) ||
          (n.axis === "activity" && n.value === "walking"),
      );
      const missing = needs.filter((n) => !matches.includes(n));
      const weightedFit = total
        ? matches.reduce((sum, n) => sum + weight(n), 0) / total
        : 0;
      const essentials = needs.filter((n) => n.importance === "essential");
      const essentialFit = essentials.length
        ? matches.filter((n) => n.importance === "essential").length /
          essentials.length
        : 1;
      const fit = identityConflict ? 0 : Math.min(weightedFit, essentialFit);
      return {
        ref: { id: entry.id, version: entry.version },
        name: entry.name,
        fit,
        missing,
        matches,
        ...(conflicts.length ? { conflicts } : {}),
        ...(identityConflict ? { identityConflict: true } : {}),
      };
    })
    .sort(
      (a, b) => b.fit - a.fit || refKey(a.ref).localeCompare(refKey(b.ref)),
    );
  const top = ranking[0];
  const essentialMissing =
    top?.missing.filter((n) => n.importance === "essential").length ??
    needs.filter((n) => n.importance === "essential").length;
  const eligible =
    allowGrowth &&
    total > 0 &&
    (essentialMissing > 0 || !!top?.identityConflict) &&
    (top?.fit ?? 0) < 0.55;
  // A conservative proposal floor only wins for substantial spatial deficits.
  // It never certifies feasibility or admits a generated recipe by itself.
  return {
    policy: "reuse-first-v4",
    ranking,
    selected: top && top.fit > 0 && !top.identityConflict ? top.ref : undefined,
    growth: {
      eligible,
      score: eligible ? 0.6 : 0,
      reason: !total
        ? "没有足够的空间需求，不能据此扩库"
        : eligible
          ? "已有场景缺少重要空间要素；允许提案，仍需代表性、可实现性和查重验证"
          : !allowGrowth
            ? "生长已关闭，优先复用并保留缺口"
            : "已有场景具有足够覆盖，优先调整氛围、组件和编排",
    },
  };
}
