import type { Plan } from "../model";
import {
  validateInterpretation,
  type Interpretation,
  type SemanticResult,
  type WindowEvidence,
} from "./semantic-contract";
import { intentions, viewpoints } from "./narrative-vocabulary";
import { duration as span } from "./plan-time";
export { intentions, viewpoints } from "./narrative-vocabulary";
export interface Structure {
  provider: "all-in-one-json";
  version: 1;
  binding: string;
  segments: { start: number; end: number; label: string }[];
  beats: number[];
  downbeats: number[];
}
export interface NarrativeSegment {
  start: number;
  end: number;
  label: string;
  title: string;
  intent: keyof typeof intentions;
  atmosphere: string;
  view: keyof typeof viewpoints;
  note: string;
  locked: boolean;
  interpretation?: Interpretation;
  evidence?: WindowEvidence;
}
export interface NarrativeDraft {
  version: 1;
  inputKey: string;
  binding: string;
  thesis: string;
  provider:
    | "existing-plan"
    | "all-in-one-json"
    | "semantic-model"
    | "acoustic-fallback";
  automatic?: {
    baseline: SemanticResult;
    windows: WindowEvidence[];
    warning: string;
    correction: string;
  };
  structure?: Structure;
  segments: NarrativeSegment[];
}
function hash(value: unknown) {
  let n = 2166136261;
  for (const c of JSON.stringify(value))
    n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return (n >>> 0).toString(16);
}
/** Revision hint for a saved draft, including manual edits and locks.
 * Like inputKey this is not a security or release-integrity hash. */
export const narrativeRevision = (draft: NarrativeDraft) => hash(draft);
export const audioBinding = (p: Plan) =>
  hash([
    p.audio.fingerprint,
    p.audio.duration,
    p.audio.clipStart,
    p.audio.clipEnd,
  ]);
// Input revision, not a security hash. Song filename is deliberately excluded.
export const inputKey = (p: Plan) =>
  hash([audioBinding(p), p.lyrics, p.direction, p.events]);
export const isStale = (p: Plan) =>
  !!p.narrative && p.narrative.inputKey !== inputKey(p);
const finite = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const string = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function importStructure(raw: unknown, p: Plan): Structure {
  const data = raw as any;
  check(
    data &&
      Array.isArray(data.segments) &&
      data.segments.length > 0 &&
      data.segments.length <= 100,
    "结构 JSON 需要 1–100 个 segments",
  );
  let end = 0;
  const segments = data.segments.map((s: any) => {
    check(
      s &&
        finite(s.start, end, p.audio.duration) &&
        finite(s.end, s.start + 0.001, p.audio.duration) &&
        string(s.label, 60),
      "分段必须按整曲秒数有序、互不重叠且在录音范围内",
    );
    end = s.end;
    return { start: s.start, end: s.end, label: s.label };
  });
  const times = (key: string) => {
    const values = data[key] ?? [];
    check(Array.isArray(values) && values.length <= 20000, key + " 数量无效");
    let last = -1;
    return values.map((t: any) => {
      check(
        finite(t, 0, p.audio.duration) && t > last,
        key + " 必须为整曲秒数且严格递增",
      );
      last = t;
      return t;
    });
  };
  check(
    segments.some(
      (s: { start: number; end: number }) =>
        s.end > p.audio.clipStart && s.start < p.audio.clipEnd,
    ),
    "结构分段没有覆盖当前片段",
  );
  return {
    provider: "all-in-one-json",
    version: 1,
    binding: audioBinding(p),
    segments,
    beats: times("beats"),
    downbeats: times("downbeats"),
  };
}
export function validateNarrative(
  value: unknown,
  p: Plan,
): asserts value is NarrativeDraft {
  const d = value as NarrativeDraft;
  check(
    d &&
      d.version === 1 &&
      string(d.inputKey, 32) &&
      string(d.binding, 32) &&
      string(d.thesis, 500) &&
      [
        "existing-plan",
        "all-in-one-json",
        "semantic-model",
        "acoustic-fallback",
      ].includes(d.provider),
    "叙事草案版本或来源无效",
  );
  check(
    Array.isArray(d.segments) &&
      d.segments.length > 0 &&
      d.segments.length <= 100,
    "叙事分段数量无效",
  );
  // Stale drafts remain exportable; their old clip coverage is validated internally.
  let previous = 0;
  for (const s of d.segments) {
    check(
      s &&
        s.start === previous &&
        finite(s.end, s.start + 0.001, 3600) &&
        string(s.label, 60) &&
        string(s.title, 100) &&
        string(s.note, 500) &&
        s.intent in intentions &&
        s.view in viewpoints &&
        Object.hasOwn(intentions, s.intent) &&
        Object.hasOwn(viewpoints, s.view) &&
        typeof s.locked === "boolean" &&
        p.atmospheres.some((a) => a.id === s.atmosphere),
      "叙事草案时间、引用或字段无效",
    );
    previous = s.end;
    if (s.evidence) {
      const e = s.evidence;
      check(
        e.start === s.start &&
          e.end === s.end &&
          finite(e.id, 0, 100) &&
          Array.isArray(e.lyrics) &&
          e.lyrics.length <= 10000 &&
          e.lyrics.every((l) => finite(l.id, 1, 10000) && string(l.text, 500)),
        "自动分析证据无效",
      );
      check(
        (e.energy === null || finite(e.energy, 0, 1)) &&
          string(e.boundary, 200) &&
          (e.energyTrend === null || finite(e.energyTrend, -1, 1)) &&
          finite(e.onsetsPerSecond, 0, 10) &&
          (e.brightnessHz === null || finite(e.brightnessHz, 0, 24000)) &&
          Array.isArray(e.chroma) &&
          [0, 12].includes(e.chroma.length) &&
          e.chroma.every((v) => finite(v, 0, 1)) &&
          (e.tonalChange === null || finite(e.tonalChange, 0, 2)) &&
          (e.dominantPitchTrend === null ||
            finite(e.dominantPitchTrend, -128, 128)) &&
          finite(e.pitchReliability, 0, 1),
        "自动分析音乐证据无效",
      );
    }
    if (s.interpretation) {
      check(s.evidence, "解释缺少证据窗口");
      validateInterpretation({ thesis: "", segments: [s.interpretation] }, p, [
        s.evidence,
      ]);
    }
  }
  if (d.binding === audioBinding(p))
    check(Math.abs(previous - span(p)) < 0.001, "叙事草案必须完整覆盖当前片段");
  if (d.automatic) {
    check(
      string(d.automatic.warning, 1000) && string(d.automatic.correction, 500),
      "自动分析来源无效",
    );
    // Baseline is independently preserved for residual correction and comparison.
    check(
      d.automatic.baseline &&
        string(d.automatic.baseline.thesis, 500) &&
        Array.isArray(d.automatic.baseline.segments) &&
        d.automatic.baseline.segments.length <= 100,
      "自动分析基线无效",
    );
    check(
      Array.isArray(d.automatic.windows) &&
        d.automatic.windows.length > 0 &&
        d.automatic.windows.length <= 100 &&
        d.automatic.windows.every(
          (w, i) =>
            w &&
            w.id === i &&
            finite(w.start, 0, 3600) &&
            finite(w.end, w.start + 0.001, 3600) &&
            Array.isArray(w.lyrics) &&
            w.lyrics.length <= 10000 &&
            w.lyrics.every(
              (l) => l && finite(l.id, 1, 10000) && string(l.text, 500),
            ),
        ),
      "自动分析基线时间窗无效",
    );
    validateInterpretation(d.automatic.baseline, p, d.automatic.windows);
  }
  if (d.structure) {
    check(
      d.structure.provider === "all-in-one-json" &&
        d.structure.version === 1 &&
        d.structure.binding === d.binding,
      "结构来源绑定无效",
    );
    // Validate stored whole-song structure independently when the current clip changed.
    const max = Math.max(
      p.audio.duration,
      ...d.structure.segments.map((s) => s.end),
    );
    check(max <= 3600, "结构时长无效");
    importStructure(d.structure, {
      ...p,
      audio: { ...p.audio, duration: max, clipStart: 0, clipEnd: max },
    });
  }
}
