import type { Plan, Chapter } from "./model";
import type { Signal } from "./planner";
import { applyAutomatic } from "./auto-narrative";
import {
  audioBinding,
  inputKey,
  isStale,
  validateNarrative,
  intentions,
  viewpoints,
  type Structure,
  type NarrativeDraft,
  type NarrativeSegment,
} from "./domain/narrative-contract";
import { duration as span } from "./domain/plan-time";
export * from "./domain/narrative-contract";
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw Error(message);
}
export function createDraft(p: Plan, structure?: Structure): NarrativeDraft {
  const old = p.narrative,
    d = span(p),
    binding = audioBinding(p);
  const source =
    structure ?? (old?.binding === binding ? old.structure : undefined);
  if (source)
    check(source.binding === binding, "结构文件属于其他录音或片段，请重新关联");
  const locked =
    old?.binding === binding ? old.segments.filter((s) => s.locked) : [];
  const cuts = new Set<number>([0, d]);
  if (source) {
    for (const s of source.segments)
      for (const t of [s.start, s.end]) {
        const local = t - p.audio.clipStart;
        if (local > 0 && local < d) cuts.add(local);
      }
  } else for (const c of p.chapters) cuts.add(c.start);
  for (const s of locked) {
    for (const t of cuts) if (t > s.start && t < s.end) cuts.delete(t);
    cuts.add(s.start);
    cuts.add(s.end);
  }
  const boundaries = [...cuts].sort((a, b) => a - b);
  const segments = boundaries.slice(0, -1).map((start, i): NarrativeSegment => {
    const end = boundaries[i + 1],
      keep = locked.find((s) => s.start === start && s.end === end);
    if (keep) return structuredClone(keep);
    const c =
      p.chapters.filter((c) => c.start <= start).at(-1) ?? p.chapters[0];
    const s = source?.segments.find(
      (s) =>
        s.start <= start + p.audio.clipStart &&
        s.end > start + p.audio.clipStart,
    );
    return {
      start,
      end,
      label: s?.label ?? (source ? "unlabeled" : "当前章节"),
      title: s ? `${s.label} · 待编排` : c.title,
      intent:
        s?.label === "outro"
          ? "farewell"
          : s?.label === "chorus"
            ? "expand"
            : "observe",
      atmosphere: c.atmosphere ?? p.atmospheres[0].id,
      view: "overhead",
      note: "",
      locked: false,
    };
  });
  const draft: NarrativeDraft = {
    version: 1,
    inputKey: inputKey(p),
    binding,
    thesis: old?.binding === binding ? old.thesis : "",
    provider: source ? "all-in-one-json" : "existing-plan",
    ...(source ? { structure: structuredClone(source) } : {}),
    segments,
  };
  validateNarrative(draft, p);
  return draft;
}
export function evidenceFor(
  p: Plan,
  s: Pick<NarrativeSegment, "start" | "end">,
  signal: Signal,
) {
  const offset = p.audio.clipStart;
  const values =
    signal.step > 0
      ? signal.energy.slice(
          Math.floor((s.start + offset) / signal.step),
          Math.ceil((s.end + offset) / signal.step),
        )
      : [];
  const mean = values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
  const lyricOffset =
    p.lyrics.offset - (p.lyrics.basis === "song" ? offset : 0);
  const lyrics = p.lyrics.lines
    .map((l, i) => ({
      ...l,
      id: i + 1,
      start: l.start + lyricOffset,
      end: l.end + lyricOffset,
    }))
    .filter((l) => l.start < s.end && l.end > s.start);
  return {
    mean,
    onsets: p.events.filter(
      (e) =>
        e.kind === "onset" &&
        e.enabled &&
        e.time >= s.start + offset &&
        e.time < s.end + offset,
    ).length,
    lyrics,
  };
}
export function applyDraft(p: Plan): Plan {
  const draft = p.narrative;
  check(draft, "请先建立叙事草案");
  validateNarrative(draft, p);
  check(!isStale(p), "音频、歌词或方向已变化，请更新草案后再应用");
  if (draft.automatic) return applyAutomatic(p);
  const next = structuredClone(p);
  next.chapters = draft.segments.map((s) => {
    const base =
      p.chapters.filter((c) => c.start <= s.start).at(-1) ?? p.chapters[0];
    return {
      ...structuredClone(base),
      start: s.start,
      title: s.title || intentions[s.intent],
      atmosphere: s.atmosphere,
      director: {
        view: s.view,
        transition: Math.max(0.1, Math.min(8, (s.end - s.start) * 0.6)),
      },
      source: "manual",
      moment: { kind: "none", duration: 12, strength: 0.7 },
      evidence: [
        `叙事草案：${intentions[s.intent]}；人工可编辑。`,
        `结构来源：${draft.provider === "existing-plan" ? "现有章节（不是音乐结构识别）" : "外部结构 JSON（用户关联录音，未核验预测准确性）"}`,
        `机位：${viewpoints[s.view]}（沿时间线渐变）`,
        ...(s.note ? [s.note] : []),
      ],
    } as Chapter;
  });
  next.analysis.warnings = [
    "当前应用的是经编辑的叙事草案；氛围与机位已生效，旧重点镜头已关闭。",
  ];
  return next;
}
