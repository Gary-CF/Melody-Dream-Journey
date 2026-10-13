import type { Plan } from "./model";
import { smooth } from "./director";
import {
  validateCinematicScene,
  type CinematicScene,
} from "./domain/cinematic-scene";
import { coreAssets } from "./core-catalog";
import { phaseNames, scoreFrame } from "./domain/cinematic-score";
export const sequenceNames = {
  street: "路尾一灯",
  bridge: "江畔驻足",
  tavern: "暖灯酒馆",
  ridge: "山峦破晓",
  neon: "霓虹天际",
  composition: "逐曲创作",
} as const;
export type SequenceKind = keyof typeof sequenceNames;
export type Focus = "blossom" | "osmanthus" | "moon" | "lantern" | "neon";
export interface HighlightProposal {
  kind: Exclude<SequenceKind, "composition"> | "none";
  focus: Focus;
  priority: number;
  lyricId: number;
  reason: string;
}
export interface Sequence {
  composition?: CinematicScene;
  id: string;
  kind: SequenceKind;
  focus: Focus;
  start: number;
  end: number;
  reason: string;
  source: "semantic" | "review";
  lyricIds: number[];
}
export function validateProposal(raw: unknown) {
  const p = raw as HighlightProposal;
  if (
    !p ||
    ![
      ...Object.keys(sequenceNames).filter((k) => k !== "composition"),
      "none",
    ].includes(p.kind) ||
    !["blossom", "osmanthus", "moon", "lantern", "neon"].includes(p.focus) ||
    !Number.isFinite(p.priority) ||
    p.priority < 0 ||
    p.priority > 1 ||
    !Number.isInteger(p.lyricId) ||
    p.lyricId < 0 ||
    typeof p.reason !== "string" ||
    p.reason.length > 500
  )
    throw Error("重点桥段建议无效");
  return p;
}
export function validateSequences(p: Plan) {
  if (p.sequences === undefined) return;
  if (!Array.isArray(p.sequences) || p.sequences.length > 2)
    throw Error("全曲最多两个重点桥段");
  let end = -2;
  const ids = new Set();
  const entities = new Map<string, CinematicScene>();
  for (const s of p.sequences) {
    if (
      !s ||
      ids.has(s.id) ||
      typeof s.id !== "string" ||
      s.id.length > 80 ||
      !Object.hasOwn(sequenceNames, s.kind) ||
      !["blossom", "osmanthus", "moon", "lantern", "neon"].includes(s.focus) ||
      !Number.isFinite(s.start) ||
      !Number.isFinite(s.end) ||
      s.start < 0 ||
      s.end > p.audio.clipEnd - p.audio.clipStart ||
      s.end - s.start < 12 ||
      s.end - s.start > 40 ||
      s.start < end + 2 ||
      typeof s.reason !== "string" ||
      s.reason.length > 500 ||
      !["semantic", "review"].includes(s.source) ||
      !Array.isArray(s.lyricIds) ||
      !s.lyricIds.every(
        (id) => Number.isInteger(id) && id > 0 && id <= p.lyrics.lines.length,
      )
    )
      throw Error("重点桥段时间或证据无效");
    ids.add(s.id);
    if (s.kind === "composition")
      s.composition = validateCinematicScene(s.composition, [
        ...p.library.map((r) => r.id),
        ...coreAssets.map((a) => a.id),
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
      ]);
    const score = s.composition?.score;
    const composition = s.composition;
    if (composition?.entityId) {
      const owner = entities.get(composition.entityId);
      if (owner) {
        const primary = (scene: CinematicScene) =>
          scene.objects.find((o) => o.role === "primary");
        if (
          owner.traversal ||
          composition.traversal ||
          JSON.stringify(primary(owner)) !==
            JSON.stringify(primary(composition)) ||
          composition.objects.length !== 1
        )
          throw Error("共享实体不能重复建造、改变形态或绑定另一条通行路线");
      } else entities.set(composition.entityId, composition);
    }
    if (
      score &&
      (Math.abs(score.stages[4].end - (s.end - s.start)) > 0.001 ||
        Math.abs(score.anchor.time - s.start - score.stages[3].start) > 0.001)
    )
      throw Error("导演时序与旅程时间不一致");
    end = s.end;
  }
}
export function sequenceAt(p: Plan, time: number): Sequence | undefined {
  return p.features?.sequences === false
    ? undefined
    : p.sequences?.find((s) => time >= s.start && time <= s.end);
}
export function phaseAt(s: Sequence, time: number) {
  return Math.max(0, Math.min(1, (time - s.start) / (s.end - s.start)));
}
export function revealAt(s: Sequence, time: number) {
  if (s.composition?.score)
    return scoreFrame(s.composition.score, time - s.start).reveal;
  const u = phaseAt(s, time);
  return smooth((u - 0.16) / 0.26) * (1 - smooth((u - 0.72) / 0.24));
}
export function movementAt(p: Plan, time: number) {
  const s = sequenceAt(p, time);
  if (!s) return 1;
  if (s.composition?.score)
    return scoreFrame(s.composition.score, time - s.start).movement;
  const u = phaseAt(s, time);
  if (s.composition) {
    const left = 0.5 - s.composition.hold / 2,
      right = 0.5 + s.composition.hold / 2;
    if (u < 0.12) return 1;
    if (u < left) return 1 - smooth((u - 0.12) / (left - 0.12));
    if (u <= right) return 0;
    return smooth((u - right) / (0.92 - right));
  }
  // Quintessential action: approach, slow, fully stop, then gently leave. Audio clock is untouched.
  if (u < 0.16) return 1;
  if (u < 0.38) return 1 - smooth((u - 0.16) / 0.22);
  if (u < 0.7) return 0;
  if (u < 0.92) return smooth((u - 0.7) / 0.22);
  return 1;
}
export function sequenceStage(s: Sequence, time: number) {
  if (s.composition?.score)
    return phaseNames[scoreFrame(s.composition.score, time - s.start).phase];
  const u = phaseAt(s, time);
  return u < 0.16
    ? "靠近"
    : u < 0.38
      ? "放慢脚步"
      : u < 0.5
        ? "景观揭示"
        : u < 0.7
          ? "驻足聆听"
          : u < 0.92
            ? "轻轻离开"
            : "余韵";
}
/** The physical stop belongs to the authored hold, not an assumed midpoint. */
export function sequenceStop(s: Sequence) {
  const hold = s.composition?.score?.stages[3];
  return hold ? s.start + (hold.start + hold.end) / 2 : (s.start + s.end) / 2;
}
export function planHighlights(p: Plan): Sequence[] {
  const candidates = (p.narrative?.segments ?? [])
    .flatMap((s) => {
      const h = s.interpretation?.highlight;
      if (
        !h ||
        h.kind === "none" ||
        s.locked ||
        p.audio.clipEnd - p.audio.clipStart < 16
      )
        return [];
      const line = p.lyrics.lines[h.lyricId - 1];
      const anchor = line
        ? line.start +
          (p.lyrics.basis === "song" ? -p.audio.clipStart : 0) +
          p.lyrics.offset
        : (s.start + s.end) / 2;
      const length = Math.min(28, p.audio.clipEnd - p.audio.clipStart);
      const start = Math.max(
        0,
        Math.min(
          p.audio.clipEnd - p.audio.clipStart - length,
          anchor - length * 0.4,
        ),
      );
      return [
        {
          sequence: {
            id: `highlight-${s.start.toFixed(2)}`,
            kind: h.kind,
            focus: h.focus,
            start,
            end: start + length,
            reason: h.reason,
            source: "semantic" as const,
            lyricIds: h.lyricId ? [h.lyricId] : [],
          },
          priority: h.priority,
        },
      ];
    })
    .sort((a, b) => b.priority - a.priority);
  const locks = p.narrative?.segments.filter((s) => s.locked) ?? [];
  const chosen: Sequence[] = structuredClone(
    (p.sequences ?? []).filter((s) =>
      locks.some((l) => s.start < l.end && s.end > l.start),
    ),
  );
  for (const c of candidates)
    if (
      chosen.length < 2 &&
      (chosen.length === 0 || c.priority >= 0.75) &&
      !locks.some(
        (l) => c.sequence.start < l.end && c.sequence.end > l.start,
      ) &&
      chosen.every(
        (s) => c.sequence.start >= s.end + 3 || c.sequence.end + 3 <= s.start,
      )
    )
      chosen.push(c.sequence);
  return chosen.sort((a, b) => a.start - b.start);
}
