import type { NarrativeDraft, NarrativeSegment } from "./narrative-contract";
import { narrativeRevision } from "./narrative-contract";
import type { Interpretation, WindowEvidence } from "./semantic-contract";

export type BriefStatus =
  | "missing"
  | "stale"
  | "semantic"
  | "acoustic"
  | "manual";
export interface BriefBinding {
  inputKey: string;
  binding: string;
  /** Already converted to clip seconds; used to recover timing in older saves. */
  lyricTimeline?: { id: number; text: string; start: number; end: number }[];
}
export interface BriefBeat {
  id: string;
  start: number;
  end: number;
  title: string;
  direction: Pick<
    NarrativeSegment,
    "intent" | "atmosphere" | "view" | "note" | "locked"
  >;
  evidence?: WindowEvidence;
  interpretation?: Interpretation;
  baselineInterpretation?: Interpretation;
  citedLyrics: { id: number; text: string }[];
}
export interface CreativeOpportunity {
  id: string;
  beatId: string;
  start: number;
  end: number;
  priority: number | null;
  emphasis: Interpretation["emphasis"];
  reason: string;
  uncertainty: string;
  citedLyricIds: number[];
  arc: { before: string | null; arrival: string; after: string | null };
  locked: boolean;
  // An old model suggestion is evidence of available implementation only.
  // Future scene candidates must not be restricted to this legacy vocabulary.
  legacyHint?: Interpretation["highlight"];
}
export interface CreativeBrief {
  version: 1;
  kind: "director-brief-preview";
  execution: "preview-only";
  timeBasis: "clip-seconds";
  status: BriefStatus;
  source: {
    inputKey: string;
    binding: string;
    provider: NarrativeDraft["provider"];
    notice: string;
    draftRevision: string;
  } | null;
  thesis: { effective: string; baseline: string | null; correction: string };
  beats: BriefBeat[];
  opportunities: CreativeOpportunity[];
  suggestedIds: string[];
  missingWork: readonly string[];
}

/** Read-only handoff from validated time-window analysis to future direction.
 * No filenames, song matching, scene factory, provider or energy ranking here.
 * The output states what existing evidence says; it is not a new model call,
 * a rendered scene or an artistic quality score. */
export function createCreativeBrief(
  draft: NarrativeDraft | undefined,
  current: BriefBinding,
): CreativeBrief {
  const brief: CreativeBrief = {
    version: 1,
    kind: "director-brief-preview",
    execution: "preview-only",
    timeBasis: "clip-seconds",
    status: "missing",
    source: null,
    thesis: { effective: "", baseline: null, correction: "" },
    beats: [],
    opportunities: [],
    suggestedIds: [],
    missingWork: [
      "cinematic-candidates",
      "capability-resolution",
      "spatial-compilation",
      "listening-and-art-review",
    ],
  };
  if (!draft) return brief;
  brief.source = {
    inputKey: draft.inputKey,
    binding: draft.binding,
    provider: draft.provider,
    notice: draft.automatic?.warning ?? "",
    draftRevision: narrativeRevision(draft),
  };
  brief.status =
    draft.inputKey !== current.inputKey || draft.binding !== current.binding
      ? "stale"
      : draft.provider === "semantic-model"
        ? "semantic"
        : draft.provider === "acoustic-fallback"
          ? "acoustic"
          : "manual";
  brief.thesis = {
    effective: draft.thesis,
    baseline: draft.automatic?.baseline.thesis ?? null,
    correction: draft.automatic?.correction ?? "",
  };
  brief.beats = draft.segments.map((segment, index) => {
    const { start, end, title, intent, atmosphere, view, note, locked } =
      segment;
    const interpretation = segment.interpretation;
    const highlightLyric =
      interpretation?.highlight?.kind !== "none"
        ? interpretation?.highlight?.lyricId
        : 0;
    const citedIds = [
      ...new Set([
        ...(interpretation?.lyricIds ?? []),
        ...(highlightLyric ? [highlightLyric] : []),
      ]),
    ];
    const evidence = segment.evidence
      ? structuredClone(segment.evidence)
      : undefined;
    if (evidence && brief.status !== "stale" && current.lyricTimeline) {
      evidence.lyrics = evidence.lyrics.map((line) => {
        const timed = current.lyricTimeline!.find(
          (t) => t.id === line.id && t.text === line.text,
        );
        return timed ? { ...line, start: timed.start, end: timed.end } : line;
      });
    }
    const citedLyrics = citedIds.map((id) => {
      const lyric = evidence?.lyrics.find((line) => line.id === id);
      if (!lyric) throw Error(`创作简报缺少引用歌词 L${id} 的时间窗证据`);
      return { ...lyric };
    });
    const baselineWindow = draft.automatic?.windows.find(
      (w) =>
        w.id === segment.evidence?.id && w.start === start && w.end === end,
    );
    const baseline = baselineWindow
      ? draft.automatic?.baseline.segments.find(
          (s) => s.id === baselineWindow.id,
        )
      : undefined;
    return {
      id: `beat-${index}`,
      start,
      end,
      title,
      direction: { intent, atmosphere, view, note, locked },
      evidence,
      interpretation: interpretation
        ? structuredClone(interpretation)
        : undefined,
      baselineInterpretation: baseline ? structuredClone(baseline) : undefined,
      citedLyrics,
    };
  });
  // Acoustic fallback can provide timing facts, never a fabricated lyric story.
  if (draft.provider !== "semantic-model") return brief;
  const meaning = (index: number) =>
    brief.beats[index]?.interpretation?.meaning ?? null;
  brief.opportunities = brief.beats.flatMap((beat, index) => {
    const interpretation = beat.interpretation;
    if (!interpretation) return [];
    const hint = interpretation.highlight;
    const proposed = hint && hint.kind !== "none";
    if (!proposed && interpretation.emphasis === "none") return [];
    return [
      {
        id: `opportunity-${index}`,
        beatId: beat.id,
        start: beat.start,
        end: beat.end,
        priority: proposed ? hint.priority : null,
        emphasis: interpretation.emphasis,
        reason: proposed ? hint.reason : interpretation.rationale,
        uncertainty: interpretation.uncertainty,
        citedLyricIds: beat.citedLyrics.map((line) => line.id),
        arc: {
          before: meaning(index - 1),
          arrival: interpretation.meaning,
          after: meaning(index + 1),
        },
        locked: beat.direction.locked,
        legacyHint: proposed ? structuredClone(hint) : undefined,
      },
    ];
  });
  // A transparent shortlist of existing semantic suggestions, not an invented
  // creative score. Null priorities stay unranked and require director review.
  if (brief.status === "semantic")
    brief.suggestedIds = brief.opportunities
      .filter((o) => !o.locked && o.priority !== null)
      .sort((a, b) => b.priority! - a.priority! || a.start - b.start)
      .slice(0, 2)
      .map((o) => o.id);
  return brief;
}
