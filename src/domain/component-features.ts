import type { ComponentRecipe, LibraryEntry } from "./creative-library";
import { builtInRecipes } from "../design";

/** Observable factory capabilities, not song keywords or a claim of artistic quality.
 * New factories extend this registry; names and model prose cannot add behavior. */
export const featureDescriptions = {
  "woodland-tree": "有树干和树冠的树木",
  "flowering-canopy": "可见彩色花冠",
  "falling-petals": "随时间飘落的花瓣",
  "falling-water": "沿高度流动的瀑布水面",
  "rock-landform": "实体岩石或山体",
  archway: "具有真实中空开口的门框或拱门，不能用实心山体代替",
  "water-pool": "局部水潭或水盘",
  "water-plants": "芦苇、荷叶等水边植物",
  "roofed-building": "有屋顶的建筑外观",
  "walkable-interior": "可进入并穿行的室内空间",
  bridge: "具有桥身和栏杆的结构",
  "light-source": "可见灯具或发光构造",
  furniture: "桌、椅、吧台等家具",
  signage: "招牌、站牌等标记构造",
  vehicle: "静态车辆外形，不提供乘车动作",
  "human-figure": "背景行人或人形角色",
  "geometric-form": "简单几何组装的雕塑或装置",
} as const;
export type ComponentFeature = keyof typeof featureDescriptions;
const existing: Record<string, ComponentFeature[]> = {
  "cafe-set": ["furniture"],
  bicycle: ["vehicle"],
  shelter: ["roofed-building", "light-source"],
  willow: ["woodland-tree"],
  reeds: ["water-plants"],
  boat: ["vehicle"],
  pavilion: ["roofed-building"],
  mountains: ["rock-landform"],
  "roof-garden": ["roofed-building"],
  "light-fins": ["light-source"],
  lanterns: ["light-source"],
  tree: ["woodland-tree"],
  flowerTree: ["woodland-tree", "flowering-canopy"],
  shop: ["roofed-building"],
  home: ["roofed-building"],
  tower: ["roofed-building"],
  lamp: ["light-source"],
  bus: ["vehicle"],
  bench: ["furniture"],
  stop: ["signage"],
  person: ["human-figure"],
  "core-sakura": ["woodland-tree", "flowering-canopy"],
  "core-osmanthus": ["woodland-tree", "flowering-canopy"],
  "core-willow": ["woodland-tree"],
  "core-pine": ["woodland-tree"],
  "core-pavilion": ["roofed-building"],
  "core-moonGate": ["geometric-form", "archway"],
  "core-redBridge": ["bridge"],
  "core-stoneBridge": ["bridge"],
  "core-stoneLantern": ["light-source"],
  "core-paperLantern": ["light-source"],
  "core-rocks": ["rock-landform"],
  "core-mountain": ["rock-landform"],
  "core-ridge": ["rock-landform"],
  "core-stoneArch": ["rock-landform", "archway"],
  "core-reeds": ["water-plants"],
  "core-lotus": ["water-plants"],
  "core-tavern": ["roofed-building", "walkable-interior", "light-source"],
  "core-bar": ["furniture"],
  "core-table": ["furniture"],
  "core-stool": ["furniture"],
  "core-shelves": ["furniture"],
  "core-lattice": ["geometric-form"],
  "core-pendant": ["light-source"],
  "core-neon": ["light-source", "signage"],
  "core-truss": ["geometric-form"],
  "core-beacon": ["light-source"],
};
export const generatorFeatures: Record<
  Exclude<ComponentRecipe["generator"], "existing">,
  ComponentFeature[]
> = {
  "branching-tree": ["woodland-tree", "flowering-canopy", "falling-petals"],
  cascade: ["falling-water", "rock-landform", "water-pool"],
  colonnade: ["roofed-building", "walkable-interior", "light-source"],
  assembly: ["geometric-form"],
};
export function factoryFeatures(assetId: string): ComponentFeature[] {
  if (existing[assetId]) return [...existing[assetId]];
  const recipe = builtInRecipes().find((p) => p.id === assetId);
  return recipe
    ? [
        "geometric-form",
        ...(recipe.parts.some((p) => p.glow) ? ["light-source" as const] : []),
      ]
    : [];
}
export function componentFeatures(entry: LibraryEntry): ComponentFeature[] {
  if (entry.layer !== "component") return [];
  const r = entry.recipe;
  if (r.generator === "existing") return factoryFeatures(r.assetId);
  if (r.generator === "branching-tree")
    return generatorFeatures[r.generator].filter(
      (f) => f !== "falling-petals" || r.fallingPetals,
    );
  return [...generatorFeatures[r.generator]];
}
function featureList(
  raw: unknown,
  min: number,
  max: number,
): ComponentFeature[] {
  if (
    !Array.isArray(raw) ||
    raw.length < min ||
    raw.length > max ||
    raw.some(
      (f) => typeof f !== "string" || !Object.hasOwn(featureDescriptions, f),
    )
  )
    throw Error("主体可见能力要求无效");
  return [...new Set(raw)] as ComponentFeature[];
}
export const validateFeatures = (raw: unknown) => featureList(raw, 1, 4);
export const validateExcludedFeatures = (raw: unknown) =>
  featureList(raw, 0, 8);
export const supportsFeatures = (
  features: readonly ComponentFeature[],
  required: readonly ComponentFeature[],
) => required.every((f) => features.includes(f));
export function subjectOptions(
  required: ComponentFeature[],
  library: { entries: LibraryEntry[] },
  growth: boolean,
  excluded: readonly ComponentFeature[] = [],
): string[] {
  return [
    ...library.entries
      .filter(
        (e) =>
          e.layer === "component" &&
          e.state !== "retired" &&
          !componentFeatures(e).some((f) => excluded.includes(f)) &&
          supportsFeatures(componentFeatures(e), required),
      )
      .map((e) => `${e.id}@${e.version}`),
    ...(growth
      ? Object.entries(generatorFeatures)
          .filter(
            ([, features]) =>
              supportsFeatures(features, required) &&
              !features.some((f) => excluded.includes(f)),
          )
          .map(([name]) => `grow:${name}`)
      : []),
  ];
}
