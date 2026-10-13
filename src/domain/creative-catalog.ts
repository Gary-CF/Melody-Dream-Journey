import { atmospheres, builtInRecipes } from "../design";
import { cinematicAtmospheres } from "./cinematic-atmospheres";
import { coreAssets } from "../core-catalog";
import { builtinGeometry } from "./builtin-geometry";
import {
  journeyStyle,
  type CreativeLibrary,
  type LibraryEntry,
  type SceneRecipe,
} from "./creative-library";

const common = {
  version: 1,
  styleId: journeyStyle.id,
  state: "stable" as const,
  origin: "builtin" as const,
  provenance: { source: "builtin", candidate: "", generatorVersion: "1" },
};
const scenes: {
  id: string;
  name: string;
  description: string;
  recipe: SceneRecipe;
}[] = [
  {
    id: "world-neighborhood",
    name: "生活街区",
    description: "沿街小店、住宅、路灯与日常行走",
    recipe: {
      terrain: "land",
      road: "paving",
      density: 1,
      population: 0.5,
      components: ["shop", "home", "tree", "lamp"],
      facets: [
        { axis: "settlement", value: "urban", importance: "essential" },
        { axis: "activity", value: "everyday", importance: "preferred" },
        { axis: "reality", value: "real", importance: "preferred" },
      ],
      futureUses: ["日常陪伴", "街头记忆"],
    },
  },
  {
    id: "world-waterfront",
    name: "水岸漫步",
    description: "沿水长路、桥岸、疏朗植物与开阔水面",
    recipe: {
      terrain: "waterfront",
      road: "timber",
      density: 0.6,
      population: 0.2,
      components: ["flowerTree", "lamp", "bench"],
      facets: [
        { axis: "terrain", value: "waterfront", importance: "essential" },
        { axis: "activity", value: "walking", importance: "preferred" },
        { axis: "reality", value: "real", importance: "preferred" },
      ],
      futureUses: ["江畔相遇", "告别与远行"],
    },
  },
  {
    id: "world-forest",
    name: "林间小径",
    description: "植物围合的自然空间，林隙允许景观展开",
    recipe: {
      terrain: "land",
      road: "earth",
      density: 0.9,
      population: 0,
      components: ["tree", "flowerTree"],
      facets: [
        { axis: "terrain", value: "forest", importance: "essential" },
        { axis: "settlement", value: "wild", importance: "preferred" },
        { axis: "reality", value: "real", importance: "preferred" },
      ],
      futureUses: ["自然疗愈", "林中探寻"],
    },
  },
  {
    id: "world-ridge",
    name: "山间观景",
    description: "高地、远山与疏朗树木；当前落脚面保持平坦",
    recipe: {
      terrain: "highland",
      road: "stone",
      density: 0.35,
      population: 0,
      components: ["tree"],
      facets: [
        { axis: "terrain", value: "mountain", importance: "essential" },
        { axis: "settlement", value: "wild", importance: "preferred" },
        { axis: "activity", value: "overlook", importance: "preferred" },
        { axis: "reality", value: "real", importance: "preferred" },
      ],
      futureUses: ["辽阔与释放", "远行归途"],
    },
  },
  {
    id: "world-city-center",
    name: "都市街道",
    description: "楼群、公共交通与较密集的步行活动；昼夜由氛围决定",
    recipe: {
      terrain: "land",
      road: "paving",
      density: 1.2,
      population: 0.8,
      components: ["tower", "shop", "lamp", "bus"],
      facets: [
        { axis: "settlement", value: "urban", importance: "essential" },
        { axis: "era", value: "modern", importance: "preferred" },
        { axis: "activity", value: "nightlife", importance: "preferred" },
        { axis: "reality", value: "real", importance: "preferred" },
      ],
      futureUses: ["城市节奏", "街头张力"],
    },
  },
];

/** Inventory describes actual executable primitives. Planned worlds are not advertised as available. */
export function builtInCreativeLibrary(): CreativeLibrary {
  const entries: LibraryEntry[] = scenes.map((s) => ({
    ...common,
    ...s,
    layer: "scene",
    tags: s.recipe.facets.map((f) => f.value),
  }));
  entries.push(
    ...[...atmospheres, ...cinematicAtmospheres].map((a) => {
      const { id, name, ...lighting } = a;
      return {
        ...common,
        id: `mood-${id}`,
        name,
        description: `可复用光线配方：${name}；天气与光线独立`,
        tags: [id],
        layer: "atmosphere" as const,
        recipe: { lighting, weather: "inherit" as const, intensity: 0 },
      };
    }),
  );
  const baseAssets = [
    ["tree", "街边树"],
    ["flowerTree", "小花树"],
    ["shop", "沿街小店"],
    ["home", "住宅"],
    ["tower", "楼宇"],
    ["lamp", "暖光路灯"],
    ["bus", "公交车"],
    ["person", "行人"],
    ["bench", "长椅"],
    ["stop", "站牌"],
  ].map(([id, name]) => ({ id, name, tags: ["daily"] }));
  const assets = [
    ...baseAssets,
    ...coreAssets.map((a) => ({ id: a.id, name: a.name, tags: a.tags })),
    ...builtInRecipes().map((r) => ({ id: r.id, name: r.name, tags: r.tags })),
  ];
  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.id)) continue;
    seen.add(asset.id);
    entries.push({
      ...common,
      id: `part-${asset.id}`,
      name: asset.name,
      description: asset.name,
      tags: asset.tags,
      layer: "component",
      recipe: { generator: "existing", assetId: asset.id },
      ...(builtinGeometry[asset.id]
        ? { geometry: builtinGeometry[asset.id] }
        : {}),
    });
  }
  return { version: 1, entries: structuredClone(entries) };
}
