import type { Atmosphere, Recipe } from "../design";

export type LibraryLayer = "scene" | "atmosphere" | "component";
export type ReviewState = "technical-preview" | "stable" | "retired";
export interface LibraryRef {
  id: string;
  version: number;
}
export interface StyleContract {
  id: string;
  geometry: string;
  material: string;
  palette: string;
  scale: string;
}
export const journeyStyle: StyleContract = {
  id: "quiet-miniature-v1",
  geometry:
    "清晰剪影、简化几何、主次分明；重点主体有枝干等结构层级，避免简单放大球体",
  material: "柔和哑光、克制自发光；水面和雨后湿润提供局部反射",
  palette: "有限主色、冷暖关系和有动机的光源；避免所有对象同等鲜艳",
  scale: "白色小观察者维持尺度参照；主要高潮主体可以巨大，通行和眼位必须有效",
};
export interface WorldFacet {
  axis: "terrain" | "settlement" | "era" | "activity" | "reality";
  value: string;
  importance: "essential" | "preferred";
}
export interface SceneRecipe {
  terrain: "land" | "waterfront" | "highland";
  road: "paving" | "stone" | "earth" | "timber";
  density: number;
  population: number;
  components: string[];
  decorations?: LibraryRef[];
  facets: WorldFacet[];
  futureUses: string[];
}
export interface AtmosphereRecipe {
  lighting: Omit<Atmosphere, "id" | "name">;
  weather:
    | "inherit"
    | "clear"
    | "cloudy"
    | "drizzle"
    | "rain"
    | "mist"
    | "afterRain";
  intensity: number;
}
export type ComponentRecipe =
  | { generator: "existing"; assetId: string }
  | {
      generator: "branching-tree";
      revision?: 2;
      height: number;
      spread: number;
      bloom: number;
      trunk: string;
      foliage: string;
      seed: number;
      fallingPetals?: boolean;
    }
  | {
      generator: "cascade";
      revision?: 2 | 3 | 4;
      height: number;
      width: number;
      tiers: number;
      rock: string;
      water: string;
      moss: string;
      seed: number;
    }
  | {
      generator: "colonnade";
      width: number;
      length: number;
      height: number;
      bays: number;
      roof: "flat" | "gable";
      stone: string;
      roofColor: string;
      accent: string;
    }
  | {
      generator: "assembly";
      placement: Recipe["placement"];
      parts: Recipe["parts"];
    };
interface EntryBase extends LibraryRef {
  name: string;
  description: string;
  tags: string[];
  styleId: string;
  state: ReviewState;
  origin: "builtin" | "generated";
  provenance: { source: string; candidate: string; generatorVersion: string };
  geometry?: { extent: [number, number, number]; minimumY: number };
}
export type LibraryEntry = EntryBase &
  (
    | { layer: "scene"; recipe: SceneRecipe }
    | { layer: "atmosphere"; recipe: AtmosphereRecipe }
    | { layer: "component"; recipe: ComponentRecipe }
  );
export interface CreativeLibrary {
  version: 1;
  entries: LibraryEntry[];
}
export interface LibraryUsage {
  ref: LibraryRef;
  source: string;
  candidate: string;
}
export const refKey = (ref: LibraryRef) => `${ref.id}@${ref.version}`;
export function resolveEntry(
  library: CreativeLibrary,
  ref: LibraryRef,
): LibraryEntry {
  const entry = library.entries.find(
    (e) => e.id === ref.id && e.version === ref.version,
  );
  if (!entry || entry.state === "retired")
    throw Error(`库版本不可用：${refKey(ref)}`);
  return entry;
}
// Stable serialization provides reproducible content identities without browser or crypto APIs.
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function contentId(value: unknown): string {
  let a = 2166136261,
    b = 5381;
  for (const char of canonical(value)) {
    const n = char.charCodeAt(0);
    a = Math.imul(a ^ n, 16777619);
    b = Math.imul(b, 33) ^ n;
  }
  return `${(a >>> 0).toString(16).padStart(8, "0")}${(b >>> 0).toString(16).padStart(8, "0")}`;
}
export const entryIdentity = (
  entry: Pick<LibraryEntry, "layer" | "recipe" | "styleId">,
) =>
  canonical({ layer: entry.layer, recipe: entry.recipe, style: entry.styleId });
/** Duplicate metadata does not create another asset. IDs never overwrite a different recipe. */
export function registerEntries(
  library: CreativeLibrary,
  additions: LibraryEntry[],
): { library: CreativeLibrary; refs: LibraryRef[] } {
  const next = structuredClone(library),
    refs: LibraryRef[] = [];
  for (const entry of additions) {
    const duplicate = next.entries.find(
      (e) => e.state !== "retired" && entryIdentity(e) === entryIdentity(entry),
    );
    if (duplicate) {
      refs.push({ id: duplicate.id, version: duplicate.version });
      continue;
    }
    if (next.entries.some((e) => refKey(e) === refKey(entry)))
      throw Error("不可覆盖已经注册的库版本");
    next.entries.push(structuredClone(entry));
    refs.push({ id: entry.id, version: entry.version });
  }
  return { library: next, refs };
}
export {
  chooseScene,
  type SceneScore,
  type SceneDecision,
} from "./scene-selection";
