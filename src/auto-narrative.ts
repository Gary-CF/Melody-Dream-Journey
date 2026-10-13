import { coreAssets } from "./core-catalog";
import { weatherNames } from "./weather";
import {
  availableSequences,
  sequenceCapabilities,
} from "./semantic-capabilities";
import { mergeDirection } from "./direction-grounding";
import { planHighlights } from "./sequences";
import type { Plan } from "./model";
import { duration, lyricTime, lyricEnd } from "./domain/plan-time";
import {
  audioBinding,
  inputKey,
  intentions,
  viewpoints,
  validateNarrative,
  type NarrativeDraft,
  type NarrativeSegment,
} from "./domain/narrative-contract";
import type { Signal } from "./planner";
import { compositionAssets } from "./domain/composition-catalog";
import type {
  SemanticProvider,
  SemanticRequest,
} from "./domain/semantic-provider";
import { localSemanticProvider } from "./adapters/http-semantic-provider";
import {
  validateInterpretation,
  type Interpretation,
  type SemanticResult,
  type WindowEvidence,
} from "./domain/semantic-contract";
export {
  validateInterpretation,
  type Interpretation,
  type SemanticResult,
  type WindowEvidence,
} from "./domain/semantic-contract";

const mean = (a: number[]) =>
  a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
const cosineChange = (a: number[], b: number[]) =>
  a.length && b.length
    ? Math.max(
        0,
        1 -
          a.reduce((s, v, i) => s + v * b[i], 0) /
            (Math.hypot(...a) * Math.hypot(...b) || 1),
      )
    : 0;
export function windowEvidence(
  p: Plan,
  signal: Signal,
  start: number,
  end: number,
): WindowEvidence {
  const offset = p.audio.clipStart,
    from = start + offset,
    to = end + offset;
  const energy =
    signal.step > 0
      ? signal.energy.slice(
          Math.floor(from / signal.step),
          Math.ceil(to / signal.step),
        )
      : [];
  const half = Math.floor(energy.length / 2),
    frames = (signal.frames ?? []).filter((f) => f.time >= from && f.time < to);
  const chroma = Array.from(
    { length: 12 },
    (_, i) => mean(frames.map((f) => f.chroma[i])) ?? 0,
  );
  const pitches = frames
    .filter((f) => f.pitch !== null && f.pitchClarity >= 0.12)
    .map((f) => f.pitch!);
  return {
    id: 0,
    start,
    end,
    boundary: "",
    lyrics: p.lyrics.lines
      .map((l, i) => ({ ...l, id: i + 1 }))
      .filter((l) => lyricTime(l, p) < end && lyricEnd(l, p) > start)
      .map((l) => ({
        id: l.id,
        text: l.text,
        start: lyricTime(l, p),
        end: lyricEnd(l, p),
      })),
    energy: mean(energy),
    energyTrend:
      energy.length > 1
        ? mean(energy.slice(half))! - mean(energy.slice(0, half))!
        : null,
    onsetsPerSecond:
      p.events.filter(
        (e) => e.enabled && e.kind === "onset" && e.time >= from && e.time < to,
      ).length /
      (end - start),
    brightnessHz: mean(frames.map((f) => f.brightness)),
    chroma: frames.length ? chroma : [],
    tonalChange: null,
    dominantPitchTrend:
      pitches.length >= 4
        ? mean(pitches.slice(Math.floor(pitches.length / 2)))! -
          mean(pitches.slice(0, Math.floor(pitches.length / 2)))!
        : null,
    pitchReliability: frames.length ? pitches.length / frames.length : 0,
  };
}
// Candidate changes combine independent audio evidence and lyric timing. No song identity or mood keywords.
export function analyzeWindows(
  p: Plan,
  signal: Signal,
  semanticCuts: { time: number; reason: string }[] = [],
): WindowEvidence[] {
  const d = duration(p),
    min = Math.max(7, d / 80),
    max = Math.max(28, d / 50);
  const candidates: { time: number; score: number; reason: string }[] = [];
  for (const cut of semanticCuts)
    if (cut.time > 0 && cut.time < d)
      candidates.push({
        ...cut,
        score: 15,
        reason: "歌词语义转折：" + cut.reason,
      });
  for (let t = min; t < d - min; t += 2) {
    const a = windowEvidence(p, signal, Math.max(0, t - 5), t),
      b = windowEvidence(p, signal, t, Math.min(d, t + 5));
    const score =
      Math.abs((a.energy ?? 0) - (b.energy ?? 0)) * 2 +
      cosineChange(a.chroma, b.chroma) +
      Math.abs((a.brightnessHz ?? 0) - (b.brightnessHz ?? 0)) / 3000 +
      Math.abs(a.onsetsPerSecond - b.onsetsPerSecond) * 0.15;
    if (score > 0.28)
      candidates.push({
        time: t,
        score,
        reason: "能量／音色／音高分布的联合变化候选",
      });
  }
  for (let i = 1; i < p.lyrics.lines.length; i++) {
    const t = lyricTime(p.lyrics.lines[i], p),
      prev = p.lyrics.lines[i - 1];
    if (t > min && t < d - min && t - lyricEnd(prev, p) > 1.5)
      candidates.push({
        time: t,
        score: 0.4,
        reason: "歌词间隔候选（不是已识别的主副歌）",
      });
  }
  const structure =
    p.narrative?.binding === audioBinding(p)
      ? p.narrative.structure
      : undefined;
  for (const s of structure?.segments ?? []) {
    const t = s.start - p.audio.clipStart;
    if (t > 0 && t < d)
      candidates.push({ time: t, score: 10, reason: `外部结构：${s.label}` });
  }
  const selected = [
    { time: 0, score: 10, reason: "片段起点" },
    { time: d, score: 10, reason: "片段终点" },
  ];
  for (const c of candidates.sort((a, b) => b.score - a.score))
    if (selected.every((s) => Math.abs(s.time - c.time) >= min))
      selected.push(c);
  selected.sort((a, b) => a.time - b.time);
  for (let i = 0; i < selected.length - 1; i++) {
    const a = selected[i],
      b = selected[i + 1];
    if (b.time - a.time > max) {
      const ideal =
        a.time + (b.time - a.time) / Math.ceil((b.time - a.time) / max);
      const nearby = p.lyrics.lines
        .map((l) => lyricTime(l, p))
        .filter(
          (t) =>
            Math.abs(t - ideal) < 3 && t - a.time >= min && b.time - t >= min,
        )
        .sort((a, b) => Math.abs(a - ideal) - Math.abs(b - ideal))[0];
      selected.splice(i + 1, 0, {
        time: nearby ?? ideal,
        score: 0,
        reason: "连续聆听窗口，未断言真实结构边界",
      });
    }
  }
  // Manual decisions have precedence without contaminating automatic evidence.
  const locked =
    p.narrative?.binding === audioBinding(p)
      ? p.narrative.segments.filter((s) => s.locked)
      : [];
  for (const s of locked) {
    for (let i = selected.length - 1; i >= 0; i--)
      if (selected[i].time > s.start && selected[i].time < s.end)
        selected.splice(i, 1);
    for (const t of [s.start, s.end])
      if (!selected.some((c) => c.time === t))
        selected.push({ time: t, score: 20, reason: "人工锁定边界" });
  }
  selected.sort((a, b) => a.time - b.time);
  const result = selected.slice(0, -1).map((c, i) => ({
    ...windowEvidence(p, signal, c.time, selected[i + 1].time),
    id: i,
    boundary: c.reason,
  }));
  result.forEach(
    (s, i) =>
      (s.tonalChange =
        i && s.chroma.length && result[i - 1].chroma.length
          ? cosineChange(s.chroma, result[i - 1].chroma)
          : null),
  );
  return result;
}
export function automaticRequest(p: Plan, signal: Signal) {
  return {
    version: 1 as const,
    protocolVersion: 3 as const,
    weatherKinds: Object.keys(weatherNames),
    sequenceKinds: availableSequences(p),
    availableSequenceDescriptions: sequenceCapabilities.filter((c) =>
      availableSequences(p).includes(c.id),
    ),
    sequenceGuide:
      "整曲仅选1–2个有意义重点；bridge=江畔停步，tavern=走进温暖酒馆暂歇（需要歌词中的室内/酒馆/避雨/人际温暖语境），ridge=山峦展开，neon=城市霓虹释放。不要所有歌选古风桥景；focus的花树是视觉解释，不能伪称歌词事实。其余段kind=none。",
    windows: analyzeWindows(p, signal),
    lyricTiming: p.lyrics.source,
    lyricTimeline: p.lyrics.lines
      .map((l, i) => ({
        id: i + 1,
        start: lyricTime(l, p),
        end: lyricEnd(l, p),
        text: l.text,
      }))
      .filter((l) => l.end > 0 && l.start < duration(p)),
    limitations: [
      "音高分布与最强谱峰只表示混音的调性证据，不是已分离的人声主旋律；不要推断准确调式、歌词转写或情绪真值。",
      "输入不含音频；仅依据歌词及声学摘要。能量高不等于快乐，音色亮不等于白昼。",
    ],
    atmospheres: p.atmospheres.map((a) => ({ id: a.id, name: a.name })),
    themes: Object.keys(compositionAssets),
    intents: Object.keys(intentions),
    views: Object.keys(viewpoints),
    viewGuide: {
      overhead: "高位俯视：交代空间和旅程开篇；持续使用会削弱人物陪伴感。",
      follow: "侧后跟随：一起前行、陪伴、沿途观察。",
      eye: "平视：亲密、停留、路灯和细节，保持地平线稳定。",
      shoulder: "越肩：凝望远方或人与环境的关系。",
      first: "观察者第一人称：短暂进入人物感受，谨慎使用。",
      still: "固定目送：距离、离开、余韵。",
      reveal: "缓慢升降揭示：从局部展开到广阔空间，用于真正需要的释放。",
    },
    themeGuide: {
      shade: "树荫道路",
      sunset: "开阔街区（名称不代表黄昏）",
      night: "紧凑街巷（名称不代表夜晚）",
      river: "水岸桥路",
      ridge: "山间道路",
    },
    assets: [...p.library, ...coreAssets.filter((a) => !a.sequenceOnly)].map(
      (r) => ({ id: r.id, tags: r.tags, name: r.name }),
    ),
  };
}
export function acousticFallback(
  p: Plan,
  windows: WindowEvidence[],
): SemanticResult {
  const energies = windows.map((w) => w.energy ?? 0),
    median =
      [...energies].sort((a, b) => a - b)[Math.floor(energies.length / 2)] ?? 0;
  return {
    thesis:
      "声学预编排：依据分时段的能量、音色与音高分布安排疏密和观察距离。歌词语义尚未分析，不能据此确认歌曲意境。",
    segments: windows.map((w, i) => {
      const release = w.energy !== null && w.energy > median + 0.13,
        quiet =
          w.energy !== null &&
          (w.energy < median - 0.12 || (w.energyTrend ?? 0) < -0.15);
      return {
        id: w.id,
        title: release ? "声场展开" : quiet ? "收束与留白" : "沿途聆听",
        meaning: "歌词语义未知；这是声学变化对应的保守视觉建议。",
        rationale: `窗口依据：${w.boundary}；能量 ${w.energy?.toFixed(2) ?? "未知"}；音色重心 ${w.brightnessHz?.toFixed(0) ?? "未知"} Hz。`,
        uncertainty: "没有语义模型结论，不推断思念、告别、昼夜或曲风。",
        lyricIds: [],
        intent: release ? "expand" : quiet ? "linger" : "observe",
        atmosphere: p.atmospheres.some((a) => a.id === "day")
          ? "day"
          : p.atmospheres[0].id,
        view: release ? "reveal" : quiet ? "eye" : i ? "follow" : "overhead",
        theme: "shade",
        recipes: p.library
          .filter((r) => r.tags.includes("garden"))
          .slice(0, 4)
          .map((r) => r.id),
        transition: 8,
        emphasis: "none",
      };
    }),
  };
}
export function assembleAutomatic(
  p: Plan,
  windows: WindowEvidence[],
  result: SemanticResult,
  provider: "semantic-model" | "acoustic-fallback",
  warning: string,
  baseline = result,
): Plan {
  const next = structuredClone(p),
    locked =
      p.narrative?.binding === audioBinding(p)
        ? p.narrative.segments.filter((s) => s.locked)
        : [];
  const segments: NarrativeSegment[] = windows.map((w, i) => {
    const keep = locked.find((s) => s.start === w.start && s.end === w.end);
    if (keep) {
      const { interpretation, evidence, ...retained } = structuredClone(keep);
      return retained;
    }
    const s = result.segments[i];
    return {
      start: w.start,
      end: w.end,
      label: "自动聆听段",
      title: s.title,
      intent: s.intent,
      atmosphere: s.atmosphere,
      view: s.view,
      locked: false,
      note: "",
      interpretation: s,
      evidence: w,
    };
  });
  const draft: NarrativeDraft = {
    version: 1,
    inputKey: inputKey(p),
    binding: audioBinding(p),
    provider,
    thesis: result.thesis,
    ...(p.narrative?.binding === audioBinding(p) && p.narrative.structure
      ? { structure: p.narrative.structure }
      : {}),
    segments,
    automatic: {
      baseline,
      windows: structuredClone(windows),
      warning,
      correction:
        p.narrative?.binding === audioBinding(p)
          ? (p.narrative.automatic?.correction ?? "")
          : "",
    },
  };
  validateNarrative(draft, next);
  next.narrative = draft;
  return applyAutomatic(next);
}
export function applyAutomatic(p: Plan): Plan {
  const d = p.narrative!;
  const next = structuredClone(p);
  next.chapters = d.segments.map((s) => {
    const r = s.interpretation,
      base =
        p.chapters.filter((c) => c.start <= s.start).at(-1) ?? p.chapters[0],
      theme = r?.theme ?? base.theme;
    return {
      ...base,
      start: s.start,
      title: s.title,
      theme,
      assets: [...compositionAssets[theme]],
      recipes: r?.recipes ?? base.recipes,
      source: s.locked ? ("manual" as const) : ("rule" as const),
      atmosphere: s.atmosphere,
      weather: s.locked ? base.weather : r?.weather,
      pace: Math.max(
        0.85,
        Math.min(1.25, 0.9 + (s.evidence?.energy ?? 0.4) * 0.3),
      ),
      director: {
        view: s.view,
        transition: Math.min(r?.transition ?? 8, (s.end - s.start) * 0.6),
      },
      moment: {
        kind: r?.emphasis ?? "none",
        duration: Math.max(3, Math.min(16, s.end - s.start)),
        strength: 0.5,
      },
      evidence: [
        r?.meaning ?? "人工保留段",
        r?.rationale ?? "人工修正",
        r?.uncertainty ?? "",
        ...(s.note ? [s.note] : []),
      ],
    };
  });
  for (const chapter of next.chapters)
    if (!chapter.weather) delete chapter.weather;
  next.sequences = planHighlights(next);
  for (const seq of next.sequences) {
    const c = next.chapters.filter((c) => c.start <= seq.start).at(-1)!;
    if (seq.kind === "bridge") {
      c.theme = "river";
      c.assets = ["lamp", "bench"];
      c.recipes = [];
    }
    if (seq.kind === "ridge") c.theme = "ridge";
  }
  next.analysis = {
    method: "temporal-analysis",
    needs: d.segments
      .filter((s) => s.interpretation?.weather)
      .map((s) => ({
        tag: "天气",
        asset: weatherNames[s.interpretation!.weather!.kind],
        status: "reused" as const,
        reason:
          s.interpretation!.weather!.evidence || "模型视觉解释，非歌词事实",
      })),
    sections: d.segments.map((s) => ({
      start: s.start,
      end: s.end,
      energy: s.evidence?.energy ?? 0,
      activity: Math.min(1, (s.evidence?.onsetsPerSecond ?? 0) / 6),
      contrast: Math.min(1, s.evidence?.tonalChange ?? 0),
      tags: [],
      evidence: [s.interpretation?.rationale ?? "人工保留"],
    })),
    warnings: [
      d.automatic?.warning ?? "",
      "谱峰轨迹与音高分布不是分离后的主旋律；意境结论需试听评估。",
    ].filter(Boolean),
  };
  return next;
}

export async function requestInterpretation(
  p: Plan,
  signal: Signal,
  abort: AbortSignal,
  correction = "",
  baseline?: SemanticResult,
  fixedWindows?: WindowEvidence[],
  provider: SemanticProvider = localSemanticProvider,
): Promise<{ result: SemanticResult; windows: WindowEvidence[] }> {
  const request = automaticRequest(p, signal);
  if (baseline)
    request.sequenceKinds = ["none", ...sequenceCapabilities.map((c) => c.id)];
  if (baseline && (fixedWindows || p.narrative?.automatic))
    request.windows = structuredClone(
      fixedWindows ?? p.narrative!.automatic!.windows,
    );
  const call = async (body: SemanticRequest) => {
    abort.throwIfAborted();
    // A provider receives its own snapshot; it cannot mutate active inputs or
    // previously accepted evidence, even when supplied by an extension.
    const result = await provider.analyze(structuredClone(body), abort);
    abort.throwIfAborted();
    // Providers may retain their response object. Accepted evidence must not
    // change later if an in-process provider reuses or mutates that object.
    return structuredClone(result);
  };
  if (!baseline && request.lyricTimeline.length >= 3) {
    const structure = (await call({ ...request, task: "boundaries" })) as {
      boundaries?: { lyricId: number; reason: string }[];
    } | null;
    if (
      !structure ||
      !Array.isArray(structure.boundaries) ||
      structure.boundaries.length > 24
    )
      throw Error("模型分段结果无效");
    const used = new Set<number>();
    const cuts = structure.boundaries.map(
      (cut: { lyricId: number; reason: string }) => {
        const line = request.lyricTimeline.find((l) => l.id === cut?.lyricId);
        if (
          !line ||
          used.has(cut.lyricId) ||
          typeof cut.reason !== "string" ||
          cut.reason.length > 160
        )
          throw Error("模型分段引用了不存在的歌词转折");
        used.add(cut.lyricId);
        return { time: line.start, reason: cut.reason };
      },
    );
    request.windows = analyzeWindows(p, signal, cuts);
  }
  let data = await call({
    ...request,
    task: "interpret",
    weatherKinds: baseline ? request.weatherKinds : undefined,
    sequenceKinds: baseline ? request.sequenceKinds : undefined,
    correction,
    baseline,
  });
  if (!baseline) {
    const interpreted = validateInterpretation(data, p, request.windows);
    const direction = await call({
      ...request,
      task: "direction",
      interpretations: interpreted.segments.map((s) => ({
        id: s.id,
        meaning: s.meaning,
        intent: s.intent,
      })),
      thesis: interpreted.thesis,
      assets: [],
      viewGuide: undefined,
      themeGuide: undefined,
    });
    data = mergeDirection(
      interpreted,
      direction,
      request.windows,
      request.lyricTimeline,
    );
  }
  const segments = (data as Partial<SemanticResult> | null)?.segments;
  if (
    !Array.isArray(segments) ||
    segments.some((s) => !s?.weather || !s?.highlight)
  )
    throw Error(
      "本次分析缺少天气或桥段结果，请确认本地分析服务已更新；已有有效计划保留。",
    );
  return {
    result: validateInterpretation(data, p, request.windows),
    windows: request.windows,
  };
}
