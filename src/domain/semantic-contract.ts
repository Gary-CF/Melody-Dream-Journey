import type { Plan } from "../model";
import { coreAssets } from "../core-catalog";
import { validateWeather, type WeatherCue } from "../weather";
import { validateProposal, type HighlightProposal } from "../sequences";
import { intentions, viewpoints } from "./narrative-vocabulary";
import { compositionAssets } from "./composition-catalog";
export interface WindowEvidence {
  id: number;
  start: number;
  end: number;
  boundary: string;
  lyrics: { id: number; text: string; start?: number; end?: number }[];
  energy: number | null;
  energyTrend: number | null;
  onsetsPerSecond: number;
  brightnessHz: number | null;
  chroma: number[];
  tonalChange: number | null;
  dominantPitchTrend: number | null;
  pitchReliability: number;
}

export interface Interpretation {
  weather?: WeatherCue;
  highlight?: HighlightProposal;
  id: number;
  title: string;
  meaning: string;
  rationale: string;
  uncertainty: string;
  lyricIds: number[];
  intent: keyof typeof intentions;
  atmosphere: string;
  view: keyof typeof viewpoints;
  theme: keyof typeof compositionAssets;
  recipes: string[];
  transition: number;
  emphasis: "none" | "quiet" | "reveal" | "rise";
}
export interface SemanticResult {
  thesis: string;
  segments: Interpretation[];
}
export function validateInterpretation(
  raw: unknown,
  p: Plan,
  windows: WindowEvidence[],
): SemanticResult {
  const r = raw as SemanticResult;
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.length <= max;
  if (
    !r ||
    !str(r.thesis, 500) ||
    !Array.isArray(r.segments) ||
    r.segments.length !== windows.length
  )
    throw Error("模型结果缺少完整的时间窗口覆盖");
  const ids = new Set<number>();
  for (const s of r.segments) {
    const w = windows.find((w) => w.id === s?.id);
    if (
      !s ||
      !w ||
      ids.has(s.id) ||
      !str(s.title, 100) ||
      !str(s.meaning, 500) ||
      !str(s.rationale, 500) ||
      !str(s.uncertainty, 500) ||
      !Object.hasOwn(intentions, s.intent) ||
      !Object.hasOwn(viewpoints, s.view) ||
      !Object.hasOwn(compositionAssets, s.theme) ||
      !p.atmospheres.some((a) => a.id === s.atmosphere) ||
      !Array.isArray(s.lyricIds) ||
      s.lyricIds.length > 100 ||
      !s.lyricIds.every((id) => w.lyrics.some((l) => l.id === id)) ||
      !Array.isArray(s.recipes) ||
      s.recipes.length > 10 ||
      !s.recipes.every(
        (id) =>
          p.library.some((r) => r.id === id) ||
          coreAssets.some((a) => a.id === id && !a.sequenceOnly),
      ) ||
      !Number.isFinite(s.transition) ||
      s.transition < 2 ||
      s.transition > 20 ||
      !["none", "quiet", "reveal", "rise"].includes(s.emphasis)
    )
      throw Error(
        "模型结果含无效引用、范围或字段：" +
          JSON.stringify({
            id: s?.id,
            window: !!w,
            duplicate: ids.has(s?.id),
            lengths: [
              s?.title?.length,
              s?.meaning?.length,
              s?.rationale?.length,
              s?.uncertainty?.length,
            ],
            intent: s?.intent,
            view: s?.view,
            theme: s?.theme,
            atmosphere: s?.atmosphere,
            lyricIds: s?.lyricIds,
            allowed: w?.lyrics.map((l) => l.id),
            recipes: s?.recipes,
            transition: s?.transition,
            emphasis: s?.emphasis,
          }),
      );
    if (s.weather) validateWeather(s.weather);
    if (s.highlight) {
      validateProposal(s.highlight);
      if (
        s.highlight.lyricId &&
        !w.lyrics.some((l) => l.id === s.highlight!.lyricId)
      )
        throw Error("重点桥段引用了段外歌词");
    }
    ids.add(s.id);
  }
  return {
    thesis: r.thesis,
    segments: [...r.segments].sort((a, b) => a.id - b.id),
  };
}
