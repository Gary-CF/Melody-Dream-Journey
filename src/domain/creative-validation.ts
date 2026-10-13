import { validateAtmospheres, validateRecipes } from "../design";
import { expectedSpatialAxis } from "./spatial-vocabulary";
import {
  journeyStyle,
  type LibraryEntry,
  type CreativeLibrary,
  type SceneRecipe,
  type AtmosphereRecipe,
  type ComponentRecipe,
  type WorldFacet,
} from "./creative-library";

export function object(
  value: unknown,
  label = "对象",
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error(`${label}格式无效`);
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw Error(`${label}文本无效`);
  return value;
}
export function number(
  value: unknown,
  label: string,
  min: number,
  max: number,
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw Error(
      `${label}须在 ${min} 至 ${max} 之间，收到 ${String(value).slice(0, 40)}`,
    );
  return value;
}
export function array(
  value: unknown,
  label: string,
  min = 0,
  max = 24,
): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max)
    throw Error(`${label}数量无效`);
  return value;
}
export function choice<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T))
    throw Error(`${label}选项不受支持`);
  return value as T;
}
export function facets(raw: unknown): WorldFacet[] {
  const found = new Map<string, WorldFacet>();
  for (const value of array(raw, "空间需求", 1, 8)) {
    const f = object(value),
      axis = choice(
        f.axis,
        ["terrain", "settlement", "era", "activity", "reality"] as const,
        "空间维度",
      );
    const v = text(f.value, "空间要素", 40).toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/.test(v)) throw Error("空间要素须使用简短英文标识");
    const expected = expectedSpatialAxis(v);
    if (expected && axis !== expected)
      throw Error(
        `空间要素 ${v} 属于 ${expected}，不能以 ${axis} 制造新的场景缺口`,
      );
    const item: WorldFacet = {
      axis,
      value: v,
      importance: choice(
        f.importance,
        ["essential", "preferred"] as const,
        "要素重要性",
      ),
    };
    const key = `${axis}:${v}`,
      previous = found.get(key);
    // Repetition cannot amplify coverage or weaken an essential requirement.
    if (!previous || item.importance === "essential") found.set(key, item);
  }
  return [...found.values()];
}
export function sceneRecipe(raw: unknown): SceneRecipe {
  const r = object(raw);
  return {
    terrain: choice(
      r.terrain,
      ["land", "waterfront", "highland"] as const,
      "地貌生成器",
    ),
    road: choice(
      r.road,
      ["paving", "stone", "earth", "timber"] as const,
      "道路表面",
    ),
    density: number(r.density, "构件密度", 0.2, 1.5),
    population: number(r.population, "人群密度", 0, 1),
    components: array(r.components, "沿路构件", 0, 6).map((x) =>
      text(x, "构件标识", 64),
    ),
    ...(r.decorations !== undefined
      ? {
          decorations: array(r.decorations, "沿路库组件", 0, 6).map((raw) => {
            const ref = object(raw),
              version = number(ref.version, "沿路组件版本", 1, 9999);
            if (!Number.isInteger(version)) throw Error("组件版本必须为整数");
            return { id: text(ref.id, "沿路库组件", 64), version };
          }),
        }
      : {}),
    facets: facets(r.facets),
    futureUses: array(r.futureUses, "跨歌曲用途", 2, 4).map((x) =>
      text(x, "用途", 100),
    ),
  };
}
export function atmosphereRecipe(raw: unknown): AtmosphereRecipe {
  const r = object(raw),
    lighting = object(r.lighting);
  const [valid] = validateAtmospheres([
    { ...lighting, id: "validated", name: "校验" },
  ]);
  const { id: _, name: __, ...data } = valid;
  // Copy only supported parameters. Unknown fields never enter a renderer.
  const {
    sky,
    water,
    ground,
    light,
    accent,
    night,
    sun,
    fog,
    sparkle,
    exposure,
  } = data;
  return {
    lighting: {
      sky,
      water,
      ground,
      light,
      accent,
      night,
      sun,
      fog,
      sparkle,
      exposure,
      ...(data.sunElevation !== undefined
        ? { sunElevation: data.sunElevation }
        : {}),
      ...(data.sunAzimuth !== undefined ? { sunAzimuth: data.sunAzimuth } : {}),
    },
    weather: choice(
      r.weather,
      [
        "inherit",
        "clear",
        "cloudy",
        "drizzle",
        "rain",
        "mist",
        "afterRain",
      ] as const,
      "天气",
    ),
    intensity: number(r.intensity, "天气强度", 0, 1),
  };
}
export function componentRecipe(raw: unknown): ComponentRecipe {
  const r = object(raw),
    generator = choice(
      r.generator,
      [
        "existing",
        "branching-tree",
        "cascade",
        "colonnade",
        "assembly",
      ] as const,
      "组件生成器",
    );
  if (generator === "existing")
    return { generator, assetId: text(r.assetId, "现有组件", 64) };
  if (generator === "colonnade") {
    const color = (value: unknown) => {
      const c = text(value, "廊柱颜色", 7);
      if (!/^#[a-f0-9]{6}$/i.test(c)) throw Error("廊柱颜色无效");
      return c;
    };
    const bays = number(r.bays, "廊柱间数", 3, 7);
    if (!Number.isInteger(bays)) throw Error("廊柱间数必须为整数");
    return {
      generator,
      width: number(r.width, "廊柱宽度", 7, 14),
      length: number(r.length, "廊柱长度", 10, 22),
      height: number(r.height, "廊柱高度", 4, 10),
      bays,
      roof: choice(r.roof, ["flat", "gable"] as const, "屋顶形态"),
      stone: color(r.stone),
      roofColor: color(r.roofColor),
      accent: color(r.accent),
    };
  }
  if (generator === "cascade") {
    if (
      r.revision !== undefined &&
      r.revision !== 2 &&
      r.revision !== 3 &&
      r.revision !== 4
    )
      throw Error("瀑流生成器版本不支持");
    const color = (value: unknown) => {
      const c = text(value, "颜色", 7);
      if (!/^#[a-f0-9]{6}$/i.test(c)) throw Error("瀑流颜色无效");
      return c;
    };
    const seed = number(r.seed, "瀑流种子", 0, 4294967295),
      tiers = number(r.tiers, "瀑流层数", 1, 4);
    if (!Number.isInteger(seed) || !Number.isInteger(tiers))
      throw Error("层数与种子须为整数");
    return {
      generator,
      ...(r.revision === 2 || r.revision === 3 || r.revision === 4
        ? { revision: r.revision }
        : {}),
      height: number(r.height, "瀑流高度", 4, 24),
      width: number(r.width, "瀑流宽度", 2, 14),
      tiers,
      rock: color(r.rock),
      water: color(r.water),
      moss: color(r.moss),
      seed,
    };
  }
  if (generator === "branching-tree") {
    if (r.revision !== undefined && r.revision !== 2)
      throw Error("树木生成器版本不支持");
    const color = (v: unknown) => {
      const c = text(v, "颜色", 7);
      if (!/^#[a-f0-9]{6}$/i.test(c)) throw Error("树木颜色无效");
      return c;
    };
    const seed = number(r.seed, "树木种子", 0, 4294967295);
    if (!Number.isInteger(seed)) throw Error("种子须为整数");
    if (r.fallingPetals !== undefined && typeof r.fallingPetals !== "boolean")
      throw Error("落花参数无效");
    return {
      generator,
      ...(r.revision === 2 ? { revision: 2 as const } : {}),
      height: number(r.height, "树高", 4, 22),
      spread: number(r.spread, "树冠宽度", 3, 16),
      bloom: number(r.bloom, "花叶密度", 0.2, 1),
      trunk: color(r.trunk),
      foliage: color(r.foliage),
      seed,
      ...(r.fallingPetals !== undefined
        ? { fallingPetals: r.fallingPetals }
        : {}),
    };
  }
  const placement = choice(
      r.placement,
      ["curb", "water", "backdrop", "landmark"] as const,
      "构件摆放",
    ),
    parts = array(r.parts, "构件部件", 1, 40);
  const [valid] = validateRecipes([
    {
      id: "validated",
      version: 1,
      name: "校验",
      tags: [],
      placement,
      footprint: 1,
      origin: "generated",
      parts,
    },
  ]);
  return { generator, placement, parts: valid.parts };
}
export function validateLibrary(raw: unknown): CreativeLibrary {
  const value = object(raw);
  if (value.version !== 1) throw Error("创作库版本不受支持");
  const keys = new Set<string>();
  const entries = array(value.entries, "后台库", 1, 512).map((rawEntry) => {
    const e = object(rawEntry),
      layer = choice(
        e.layer,
        ["scene", "atmosphere", "component"] as const,
        "库层级",
      ),
      id = text(e.id, "库标识", 64),
      version = number(e.version, "库版本", 1, 9999);
    if (
      !/^[a-zA-Z0-9-]+$/.test(id) ||
      !Number.isInteger(version) ||
      keys.has(`${id}@${version}`)
    )
      throw Error("库标识重复或无效");
    keys.add(`${id}@${version}`);
    if (e.styleId !== journeyStyle.id)
      throw Error("库条目的美术风格版本不兼容");
    const p = object(e.provenance);
    const base = {
      id,
      version,
      name: text(e.name, "名称", 60),
      description: text(e.description, "描述", 500),
      tags: array(e.tags, "标签", 0, 12).map((t) => text(t, "标签", 40)),
      styleId: journeyStyle.id,
      state: choice(
        e.state,
        ["technical-preview", "stable", "retired"] as const,
        "审阅状态",
      ),
      origin: choice(e.origin, ["builtin", "generated"] as const, "来源"),
      provenance: {
        source: text(p.source, "来源", 200),
        candidate:
          typeof p.candidate === "string" ? p.candidate.slice(0, 100) : "",
        generatorVersion: text(p.generatorVersion, "生成器版本", 60),
      },
      ...(e.geometry
        ? {
            geometry: (() => {
              const g = object(e.geometry);
              return {
                extent: array(g.extent, "实测尺寸", 3, 3).map((x) =>
                  number(x, "构件尺寸", 0.001, 5000),
                ) as [number, number, number],
                minimumY: number(g.minimumY, "构件底面", -100, 100),
              };
            })(),
          }
        : {}),
    };
    return {
      ...base,
      layer,
      recipe:
        layer === "scene"
          ? sceneRecipe(e.recipe)
          : layer === "atmosphere"
            ? atmosphereRecipe(e.recipe)
            : componentRecipe(e.recipe),
    } as LibraryEntry;
  });
  return { version: 1, entries };
}
