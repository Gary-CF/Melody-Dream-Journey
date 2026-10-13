import type {
  Interpretation,
  SemanticResult,
  WindowEvidence,
} from "./domain/semantic-contract";
import { validateWeather, type WeatherCue } from "./weather";
import { validateProposal, type HighlightProposal } from "./sequences";
import {
  validateWeatherEvidence,
  isCurrentWeatherFact,
} from "./domain/weather-evidence";
export function mergeDirection(
  result: SemanticResult,
  raw: unknown,
  windows: WindowEvidence[],
  lyrics: { id: number; text: string; start: number; end: number }[],
): SemanticResult {
  const d = structuredClone(raw) as {
    weather: (WeatherCue & { id: number; lyricId: number })[];
    highlights: (HighlightProposal & { windowId: number })[];
  };
  if (d?.weather && !Array.isArray(d.weather))
    d.weather = Object.entries(d.weather).map(([id, w]) => ({
      ...(w as WeatherCue & { lyricId: number }),
      id: Number(id),
    }));
  if (
    !d ||
    !Array.isArray(d.weather) ||
    d.weather.length !== windows.length ||
    !Array.isArray(d.highlights) ||
    d.highlights.length > 2
  )
    throw Error("全曲导演结果不完整");
  const ids = new Set<number>();
  const repairs: string[] = [];
  for (const w of d.weather) {
    validateWeather({ ...w, scope: undefined });
    if (ids.has(w.id) || !windows.some((x) => x.id === w.id))
      throw Error("天气窗口重复或不存在");
    ids.add(w.id);
  }
  const highlights: typeof d.highlights = [];
  for (const h of d.highlights) {
    validateProposal(h);
    let w = windows.find((w) => w.id === h.windowId);
    if (h.kind === "none") continue;
    if (h.lyricId && (!w || !w.lyrics.some((l) => l.id === h.lyricId))) {
      const matches = windows.filter((x) =>
        x.lyrics.some((l) => l.id === h.lyricId),
      );
      if (matches.length === 1) {
        w = matches[0];
        h.windowId = w.id;
        repairs.push("重点窗口已按原文歌词引用校正。");
      } else {
        repairs.push("无法唯一定位原文的重点建议未执行。");
        continue;
      }
    }
    if (!w || (lyrics.length > 0 && !h.lyricId)) {
      repairs.push("没有有效歌词依据的重点建议未执行。");
      continue;
    }
    const previous = highlights.findIndex((x) => x.windowId === h.windowId);
    if (previous >= 0) {
      if (h.priority > highlights[previous].priority) highlights[previous] = h;
      repairs.push("同段重复重点已合并，保留较高优先级。");
    } else highlights.push(h);
  }
  d.highlights = highlights;
  return {
    ...result,
    segments: result.segments.map((s) => {
      const w = d.weather.find((w) => w.id === s.id)!;
      let weather: WeatherCue = {
        kind: w.kind,
        intensity: w.intensity,
        context: w.context,
        evidence: w.evidence,
        ...(w.scope ? { scope: validateWeatherEvidence(w.scope) } : {}),
      };
      let warning = "";
      const line = lyrics.find((l) => l.id === w.lyricId),
        window = windows.find((w) => w.id === s.id)!;
      const quote = w.evidence.replace(/[“”‘’「」]/g, "").trim();
      const grounded =
        !!line &&
        !!quote &&
        line.text.includes(quote) &&
        line.start < window.end;
      const physical = quote.toLowerCase();
      const figurative =
        /心里|心中|眼泪|比喻|像.{0,12}(?:雨|暴雨)|heart|tears|like.{0,12}rain/.test(
          physical,
        );
      const dry =
        /没有下雨|没下雨|不下雨|无雨|干燥|晴朗|晴空|not raining|no rain|dry/.test(
          physical,
        );
      const stopped = /雨停|雨后|rain.{0,12}stop|after.{0,8}rain/.test(
        physical,
      );
      const rain = /雨|rain|drizzl/.test(physical);
      const cloud = /灰云|阴云|阴天|乌云|overcast|cloudy/.test(physical);
      const fog = /雾|fog|mist/.test(physical);
      if (weather.scope) {
        const scope = weather.scope;
        if (
          scope.sourceIds.some(
            (id) => !lyrics.some((l) => l.id === id && l.start < window.end),
          )
        )
          throw Error("天气范围引用了不存在或尚未出现的上下文");
        if (grounded && !scope.sourceIds.includes(w.lyricId)) {
          // The exact quote was independently matched to an existing, already
          // occurring line. Join that known provenance rather than ask a model
          // to repeat the same ID correctly in two different fields.
          scope.sourceIds = [...scope.sourceIds, w.lyricId];
          validateWeatherEvidence(scope);
        }
        const literal =
          scope.temporal === "present" &&
          scope.reality === "physical" &&
          scope.polarity === "affirmed" &&
          scope.presentation === "literal";
        const evoked =
          scope.presentation === "evoked" &&
          scope.polarity === "affirmed" &&
          ["memory", "dream"].includes(scope.reality);
        // Keep the scoped interpretation; a short quote cannot reclassify its narrative time.
        weather.context = literal
          ? "present"
          : scope.reality === "memory"
            ? "memory"
            : scope.reality === "dream"
              ? "dream"
              : scope.reality === "metaphor"
                ? "metaphor"
                : "unspecified";
        if (!(literal && scope.presentation === "literal") && !evoked) {
          weather.kind = "clear";
          weather.intensity = 1;
          if (!isCurrentWeatherFact(scope, weather.kind))
            warning = `天气未作为当前事实执行：${scope.reason}`;
        }
        if (isCurrentWeatherFact(scope, weather.kind))
          weather.context = "present";
      } else if (grounded) {
        if (dry || figurative)
          weather = {
            ...weather,
            kind: "clear",
            intensity: 1,
            context: figurative ? "metaphor" : "present",
          };
        else if (stopped)
          weather = {
            ...weather,
            kind: "afterRain",
            intensity: 1,
            context: "present",
          };
        else if (rain) {
          weather = {
            ...weather,
            kind: /细雨|小雨|drizzl/.test(physical) ? "drizzle" : "rain",
            intensity: Math.max(0.6, w.intensity),
            context: w.context,
          };
        } else if (cloud)
          weather = {
            ...weather,
            kind: "cloudy",
            intensity: Math.max(0.6, w.intensity),
            context: "present",
          };
        else if (fog)
          weather = { ...weather, kind: "mist", context: "present" };
        else if (weather.kind !== "clear") {
          warning = "引用原文未支持实际天气变化，保留意境解释但不制造降雨。";
          weather = {
            kind: "clear",
            intensity: 1,
            context: "unspecified",
            evidence: warning,
          };
        }
      }
      // This is a capability/evidence check, never a song-specific keyword planner.
      if (weather.kind !== "clear" && !grounded) {
        warning = "天气原文依据不足，未将推测渲染为降雨或雾。";
        weather = {
          kind: "clear",
          intensity: 1,
          context: "unspecified",
          evidence: warning,
        };
      }
      if (
        weather.context === "metaphor" &&
        ["rain", "drizzle", "afterRain"].includes(weather.kind)
      ) {
        warning = "比喻保留在意境解释中，不据此制造真实雨景。";
        weather = {
          ...weather,
          kind: "clear",
          intensity: 1,
          evidence: quote + "；" + warning,
        };
      }
      const h = d.highlights.find((h) => h.windowId === s.id);
      const highlight: HighlightProposal = h
        ? {
            kind: h.kind,
            focus:
              h.kind === "tavern" || h.kind === "street"
                ? "lantern"
                : h.kind === "neon"
                  ? "neon"
                  : h.kind === "bridge" && h.focus === "neon"
                    ? "lantern"
                    : h.focus,
            priority: h.priority,
            lyricId: h.lyricId,
            reason: h.reason,
          }
        : {
            kind: "none",
            focus: "lantern",
            priority: 0,
            lyricId: 0,
            reason: "",
          };
      return {
        ...s,
        weather,
        highlight,
        uncertainty: [...new Set(repairs), warning, s.uncertainty]
          .filter(Boolean)
          .join(" ")
          .slice(0, 500),
      };
    }),
  };
}
