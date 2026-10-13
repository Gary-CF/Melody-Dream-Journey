import { coreAssets } from "./core-catalog";
import { validateSequences } from "./sequences";
import { validateWeather } from "./weather";
import {
  validateNarrative,
  type NarrativeDraft,
} from "./domain/narrative-contract";
import {
  atmospheres,
  builtInRecipes,
  validateAtmospheres,
  validateRecipes,
  type Atmosphere,
  type Recipe,
  type Direction,
  type DesignAnalysis,
} from "./design";
import { duration } from "./domain/plan-time";
import { sceneRecipe } from "./domain/creative-validation";
export type Theme = "shade" | "sunset" | "night" | "river" | "ridge";
export type Asset =
  | "tree"
  | "flowerTree"
  | "shop"
  | "home"
  | "tower"
  | "lamp"
  | "bus"
  | "person"
  | "bench"
  | "stop";
export interface Lyric {
  start: number;
  end: number;
  text: string;
}
export interface Chapter {
  weather?: import("./weather").WeatherCue;
  start: number;
  title: string;
  theme: Theme;
  source: "manual" | "rule" | "preview";
  assets: Asset[];
  recipes?: string[];
  atmosphere?: string;
  pace?: number;
  moment?: {
    kind: "none" | "reveal" | "quiet" | "rise";
    duration: number;
    strength: number;
  };
  evidence?: string[];
  director?: {
    view: keyof typeof import("./domain/narrative-vocabulary").viewpoints;
    transition: number;
  };
}
export interface MusicEvent {
  time: number;
  strength: number;
  kind: "onset" | "manual";
  enabled: boolean;
}
export interface Plan {
  creativeWorld?: {
    version: 1;
    ref: import("./domain/creative-library").LibraryRef;
    recipe: import("./domain/creative-library").SceneRecipe;
    candidate: string;
    name?: string;
    title?: string;
  };
  sequences?: import("./sequences").Sequence[];
  features?: { weather?: boolean; sequences?: boolean };
  schemaVersion: 2;
  narrative?: NarrativeDraft;
  library: Recipe[];
  atmospheres: Atmosphere[];
  direction: Direction;
  analysis: DesignAnalysis;
  seed: number;
  mode: "city" | "poem";
  audio: {
    duration: number;
    clipStart: number;
    clipEnd: number;
    name: string;
    fingerprint: string;
  };
  lyrics: {
    basis: "song" | "clip";
    offset: number;
    source: "none" | "lrc" | "approximate";
    lines: Lyric[];
  };
  chapters: Chapter[];
  events: MusicEvent[];
  path: {
    speed: number;
    minInterval: number;
    threshold: number;
    turnTimes: number[];
  };
  visual: {
    density: number;
    roadWidth: number;
    distance: number;
    height: number;
    smoothing: number;
    tone: string;
    ambient: number;
    particles: number;
    moonHeight: number;
    moonSize: number;
    clothes: string;
    observerScale: number;
    quality: "high" | "low";
  };
  transition: { seconds: number; cameraExpansion: number };
}
export const assetTypes: Asset[] = [
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
];
export const themes: Theme[] = ["shade", "sunset", "night", "river", "ridge"];
export const themeNames: Record<Theme, string> = {
  shade: "树荫街道",
  sunset: "开阔街区",
  night: "紧凑街巷",
  river: "临水长桥",
  ridge: "山间道路",
};
export function defaults(mode: "city" | "poem" = "city"): Plan {
  const p: Plan = {
    schemaVersion: 2,
    library: builtInRecipes(),
    atmospheres: structuredClone(atmospheres),
    direction: { style: "auto", keywords: "", allowGrowth: true },
    analysis: {
      method: "preview",
      sections: [],
      needs: [],
      warnings: ["默认示例用于展示可复用能力，不对应任何录音的高潮。"],
    },
    seed: 233,
    mode,
    audio: {
      duration: 120,
      clipStart: 0,
      clipEnd: 120,
      name: "",
      fingerprint: "",
    },
    lyrics: { basis: "song", offset: 0, source: "none", lines: [] },
    chapters:
      mode === "city"
        ? [
            {
              start: 0,
              title: "树影里的慢时光",
              theme: "shade",
              source: "preview",
              assets: ["tree", "shop", "home", "lamp", "person", "bench"],
            },
            {
              start: 30,
              title: "转角，遇见黄昏",
              theme: "sunset",
              source: "preview",
              assets: ["tree", "shop", "tower", "bus", "stop", "person"],
            },
            {
              start: 60,
              title: "等一盏灯亮起",
              theme: "night",
              source: "preview",
              assets: ["tree", "shop", "home", "lamp", "person", "bench"],
            },
            {
              start: 90,
              title: "沿着河，继续走",
              theme: "river",
              source: "preview",
              assets: ["tree", "lamp", "bench", "person"],
            },
          ]
        : [
            {
              start: 0,
              title: "江面与月光",
              theme: "river",
              source: "preview",
              assets: ["flowerTree", "lamp", "bench"],
            },
            {
              start: 40,
              title: "花树与岸线",
              theme: "river",
              source: "preview",
              assets: ["flowerTree", "tree", "lamp", "bench"],
            },
            {
              start: 80,
              title: "月下，水天相接",
              theme: "river",
              source: "preview",
              assets: ["flowerTree", "lamp", "bench"],
            },
          ],
    events: [],
    path: {
      speed: 4.2,
      minInterval: 12,
      threshold: 0.35,
      turnTimes: [15, 30, 45, 60, 75, 90, 105],
    },
    visual: {
      density: 1,
      roadWidth: 4.2,
      distance: 34,
      height: 19,
      smoothing: 0.85,
      tone: "#eac8b2",
      ambient: 1.9,
      particles: 0.4,
      moonHeight: 15,
      moonSize: 3,
      clothes: "#ffffff",
      observerScale: 0.85,
      quality: "high",
    },
    transition: { seconds: 8, cameraExpansion: 4 },
  };
  p.chapters.forEach((c, i) => {
    c.atmosphere =
      mode === "poem" ? "moon" : ["day", "dusk", "night", "moon"][i];
    c.pace = 1;
    c.recipes =
      mode === "poem"
        ? ["willow", "reeds", "boat", "pavilion"]
        : i === 3
          ? ["willow", "boat", "pavilion"]
          : ["cafe-set", "bicycle", "planter", "shelter", "lanterns"];
    c.moment = { kind: "none", duration: 12, strength: 0.7 };
    c.evidence = ["手工能力预览，可用导入歌词与音频重新规划"];
  });
  return p;
}
export { duration, lyricTime, lyricEnd, chapterAt } from "./domain/plan-time";
export function parseLrc(text: string, fullDuration: number): Lyric[] {
  const lines: Lyric[] = [];
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000;
  for (const line of text.split(/\r?\n/)) {
    const tags = [...line.matchAll(/\[(\d+):(\d{1,2}(?:\.\d{1,3})?)\]/g)];
    const words = line.replace(/\[[^\]]*\]/g, "").trim();
    if (!words) continue;
    for (const m of tags) {
      const start = Number(m[1]) * 60 + Number(m[2]) + offset;
      if (start >= 0 && start < fullDuration)
        lines.push({ start, end: fullDuration, text: words.slice(0, 500) });
    }
  }
  lines.sort((a, b) => a.start - b.start);
  return lines
    .slice(0, 2000)
    .map((l, i) => ({ ...l, end: lines[i + 1]?.start ?? fullDuration }));
}
export function selectTurns(events: MusicEvent[], p: Plan): number[] {
  let last = 0;
  const end = duration(p);
  const turns: number[] = [];
  for (const e of [...events].sort((a, b) => a.time - b.time)) {
    const t = e.time - p.audio.clipStart;
    if (
      e.enabled &&
      e.strength >= p.path.threshold &&
      t - last >= p.path.minInterval &&
      t < end - 5
    ) {
      turns.push(t);
      last = t;
    }
  }
  return turns.slice(0, 80);
}
export function validatePlan(value: unknown): Plan {
  if (!value || typeof value !== "object") throw Error("配置应为 JSON 对象");
  const p = structuredClone(value) as Plan;
  // Version 1 keeps its original speed and arrangement when upgraded.
  if ((p.schemaVersion as number) === 1) {
    p.schemaVersion = 2;
    if (p.visual) {
      p.visual.observerScale = 0.85;
      if (p.visual.clothes === "#e9995e") p.visual.clothes = "#ffffff";
    }
    p.library = builtInRecipes();
    p.atmospheres = structuredClone(atmospheres);
    p.direction = { style: "auto", keywords: "", allowGrowth: true };
    p.analysis = {
      method: "preview",
      sections: [],
      needs: [],
      warnings: ["已从 v1 迁移，原时间与速度保持不变。"],
    };
    if (Array.isArray(p.chapters))
      for (const c of p.chapters) {
        if (p.mode === "poem") c.theme = "river";
        c.atmosphere =
          p.mode === "poem"
            ? "moon"
            : {
                shade: "day",
                sunset: "dusk",
                night: "night",
                river: "moon",
                ridge: "dawn",
              }[c.theme];
        c.pace = 1;
        c.recipes = [];
        c.moment = { kind: "none", duration: 12, strength: 0.7 };
        c.evidence = [];
      }
  }
  const finite = (n: unknown, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const ok = (condition: unknown, msg: string) => {
    if (!condition) throw Error(msg);
  };
  ok(p.schemaVersion === 2, "仅支持 schemaVersion 1 / 2");
  if (p.creativeWorld) {
    ok(
      p.creativeWorld.version === 1 &&
        typeof p.creativeWorld.ref?.id === "string" &&
        Number.isInteger(p.creativeWorld.ref.version) &&
        p.creativeWorld.ref.version > 0 &&
        typeof p.creativeWorld.candidate === "string",
      "创作世界版本无效",
    );
    p.creativeWorld.recipe = sceneRecipe(p.creativeWorld.recipe);
    for (const key of ["name", "title"] as const)
      ok(
        p.creativeWorld[key] === undefined ||
          (typeof p.creativeWorld[key] === "string" &&
            p.creativeWorld[key]!.length <= 100),
        "创作标题过长或无效",
      );
  }
  p.library = validateRecipes(p.library);
  p.atmospheres = validateAtmospheres(p.atmospheres);
  ok(
    p.direction &&
      ["auto", "acoustic", "electric", "ethereal"].includes(
        p.direction.style,
      ) &&
      typeof p.direction.keywords === "string" &&
      p.direction.keywords.length <= 500 &&
      typeof p.direction.allowGrowth === "boolean",
    "创作方向无效",
  );
  ok(
    p.analysis &&
      ["preview", "local-rules", "temporal-analysis"].includes(
        p.analysis.method,
      ) &&
      Array.isArray(p.analysis.sections) &&
      p.analysis.sections.length <= 100 &&
      Array.isArray(p.analysis.needs) &&
      p.analysis.needs.length <= 100 &&
      Array.isArray(p.analysis.warnings) &&
      p.analysis.warnings.length <= 30,
    "分析报告无效",
  );
  ok(["city", "poem"].includes(p.mode), "预览类型无效");
  ok(finite(p.seed, 0, 4294967295), "种子无效");
  ok(
    p.audio &&
      finite(p.audio.duration, 1, 3600) &&
      finite(p.audio.clipStart, 0, p.audio.duration) &&
      finite(p.audio.clipEnd, p.audio.clipStart + 1, p.audio.duration),
    "音频或片段时间范围无效",
  );
  ok(
    typeof p.audio.name === "string" &&
      p.audio.name.length < 500 &&
      typeof p.audio.fingerprint === "string",
    "音频信息无效",
  );
  const d = duration(p);
  validateSequences(p);
  if (p.features)
    ok(
      Object.entries(p.features).every(
        ([key, v]) =>
          ["weather", "sequences"].includes(key) && typeof v === "boolean",
      ),
      "功能开关无效",
    );
  for (const s of p.analysis.sections)
    ok(
      s &&
        finite(s.start, 0, d) &&
        finite(s.end, s.start, d) &&
        finite(s.energy, 0, 1) &&
        finite(s.activity, 0, 1) &&
        finite(s.contrast, 0, 1) &&
        Array.isArray(s.tags) &&
        s.tags.length <= 30 &&
        s.tags.every((t) => typeof t === "string" && t.length < 80) &&
        Array.isArray(s.evidence) &&
        s.evidence.length <= 20 &&
        s.evidence.every((t) => typeof t === "string" && t.length < 600),
      "段落分析数据无效",
    );
  for (const n of p.analysis.needs)
    ok(
      n &&
        ["reused", "generated", "missing"].includes(n.status) &&
        [n.tag, n.asset, n.reason].every(
          (s) => typeof s === "string" && s.length < 600,
        ),
      "视觉需求数据无效",
    );
  ok(
    p.analysis.warnings.every((s) => typeof s === "string" && s.length < 600),
    "分析提示无效",
  );
  ok(
    p.lyrics &&
      ["song", "clip"].includes(p.lyrics.basis) &&
      ["none", "lrc", "approximate"].includes(p.lyrics.source) &&
      finite(p.lyrics.offset, -600, 600),
    "歌词设置无效",
  );
  ok(
    Array.isArray(p.lyrics.lines) && p.lyrics.lines.length <= 2000,
    "歌词最多 2000 行",
  );
  let previous = -1;
  for (const l of p.lyrics.lines) {
    ok(
      finite(l.start, 0, p.lyrics.basis === "song" ? p.audio.duration : d) &&
        finite(
          l.end,
          l.start,
          p.lyrics.basis === "song" ? p.audio.duration : d,
        ) &&
        l.start >= previous &&
        typeof l.text === "string" &&
        l.text.length <= 500,
      "歌词时间或文本无效",
    );
    previous = l.start;
  }
  ok(
    Array.isArray(p.chapters) &&
      p.chapters.length > 0 &&
      p.chapters.length <= 100 &&
      p.chapters[0].start === 0,
    "章节须从 0 开始，最多 100 个",
  );
  previous = -1;
  for (const c of p.chapters) {
    if (c.weather) validateWeather(c.weather);
    if (c.director)
      ok(
        [
          "overhead",
          "follow",
          "eye",
          "shoulder",
          "first",
          "still",
          "reveal",
        ].includes(c.director.view) && finite(c.director.transition, 0.1, 20),
        "镜头导演字段无效",
      );
    ok(
      p.atmospheres.some((a) => a.id === c.atmosphere) &&
        finite(c.pace, 0.65, 1.35) &&
        Array.isArray(c.recipes) &&
        c.recipes.length <= 16 &&
        c.recipes.every(
          (id) =>
            p.library.some((r) => r.id === id) ||
            coreAssets.some((a) => a.id === id && !a.sequenceOnly),
        ),
      "章节氛围、速度或配方引用无效",
    );
    ok(
      c.moment &&
        ["none", "reveal", "quiet", "rise"].includes(c.moment.kind) &&
        finite(c.moment.duration, 3, 30) &&
        finite(c.moment.strength, 0, 1),
      "重点镜头配置无效",
    );
    ok(
      Array.isArray(c.evidence) &&
        c.evidence.length <= 20 &&
        c.evidence.every((s) => typeof s === "string" && s.length < 600),
      "章节依据无效",
    );
    ok(
      finite(c.start, 0, d - 0.01) &&
        c.start > previous &&
        themes.includes(c.theme) &&
        typeof c.title === "string" &&
        c.title.length <= 100 &&
        ["manual", "rule", "preview"].includes(c.source),
      "章节时间、主题或来源无效",
    );
    ok(
      Array.isArray(c.assets) &&
        c.assets.length <= 10 &&
        c.assets.every((a) => assetTypes.includes(a)),
      "构件类型或数量无效",
    );
    previous = c.start;
  }
  ok(Array.isArray(p.events) && p.events.length <= 10000, "音乐事件数量过多");
  previous = -1;
  for (const e of p.events) {
    ok(
      finite(e.time, 0, p.audio.duration) &&
        e.time >= previous &&
        finite(e.strength, 0, 1) &&
        ["onset", "manual"].includes(e.kind) &&
        typeof e.enabled === "boolean",
      "音乐事件无效",
    );
    previous = e.time;
  }
  ok(
    p.path &&
      finite(p.path.speed, 0.5, 6) &&
      finite(p.path.minInterval, 5, 60) &&
      finite(p.path.threshold, 0, 1),
    "路径参数无效",
  );
  ok(
    Array.isArray(p.path.turnTimes) && p.path.turnTimes.length <= 80,
    "转角过多",
  );
  previous = 0;
  for (const t of p.path.turnTimes) {
    ok(finite(t, 5, d - 1) && t - previous >= 5, "转角必须有序且至少间隔 5 秒");
    previous = t;
  }
  const v = p.visual;
  ok(v, "缺少视觉配置");
  for (const [key, min, max] of [
    ["density", 0.3, 1.5],
    ["roadWidth", 3, 7],
    ["distance", 15, 45],
    ["height", 12, 40],
    ["smoothing", 0, 0.98],
    ["ambient", 0.5, 3],
    ["particles", 0, 1],
    ["moonHeight", 8, 35],
    ["moonSize", 1, 6],
    ["observerScale", 0.65, 1.1],
  ] as const)
    ok(finite(v[key], min, max), `视觉参数 ${key} 无效`);
  ok(
    /^#[0-9a-f]{6}$/i.test(v.tone) &&
      /^#[0-9a-f]{6}$/i.test(v.clothes) &&
      ["high", "low"].includes(v.quality),
    "颜色或画质无效",
  );
  ok(
    p.transition &&
      finite(p.transition.seconds, 1, 20) &&
      finite(p.transition.cameraExpansion, 0, 12),
    "转场参数无效",
  );
  if (p.narrative !== undefined) validateNarrative(p.narrative, p);
  return structuredClone(p);
}
export function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
