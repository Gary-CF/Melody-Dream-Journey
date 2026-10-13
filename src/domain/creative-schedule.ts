import type { CreativeBrief } from "./creative-brief";
import {
  validateDirectionTiming,
  directionTimingSchema,
  cinematicPhases,
  type CinematicScore,
  type DirectionTiming,
} from "./cinematic-score";
export interface CreativeSlot {
  beatId: string;
  start: number;
  end: number;
  anchor: number;
  score?: CinematicScore;
}

/** Joint generation choices keep lyric anchors and authored duration budgets
 * feasible together. The scheduler still rejects incompatible complete shots;
 * it never clips a stage or changes an accepted model's chosen anchor. */
export function creativeTimingSchemas(brief: CreativeBrief, beatId: string) {
  const beat = brief.beats.find((b) => b.id === beatId);
  if (!beat || beat.direction.locked) return [];
  const duration = brief.beats.at(-1)?.end ?? 0;
  const stageSchema = directionTimingSchema.properties.stages;
  const ranges = cinematicPhases.map(
    (phase) => stageSchema.properties[phase].properties.seconds.enum,
  );
  const capsFor = (budget: number, indexes: number[]) => {
    const caps = indexes.map((i) => ranges[i][0]);
    if (caps.reduce((a, b) => a + b, 0) > budget) return;
    while (caps.reduce((a, b) => a + b, 0) < budget) {
      let changed = false;
      for (const [j, i] of indexes.entries()) {
        if (caps.reduce((a, b) => a + b, 0) >= budget) break;
        if (caps[j] < ranges[i].at(-1)!) {
          caps[j]++;
          changed = true;
        }
      }
      if (!changed) break;
    }
    return caps;
  };
  const lyrics = beat.evidence?.lyrics ?? beat.citedLyrics;
  return (lyrics.length ? lyrics : [{ id: 0 }]).flatMap((line) => {
    const origin = Math.max(
      beat.start,
      "start" in line && typeof line.start === "number"
        ? line.start
        : beat.start,
    );
    const groups = new Map<string, { caps: number[]; offsets: number[] }>();
    for (let offset = 0; offset <= 30 && origin + offset < beat.end; offset++) {
      const anchor = origin + offset;
      const locks = brief.beats.filter((b) => b.direction.locked);
      if (locks.some((b) => b.start <= anchor && b.end > anchor)) continue;
      const lower = Math.max(
        0,
        ...locks.filter((b) => b.end <= anchor).map((b) => b.end),
      );
      const upper = Math.min(
        duration,
        ...locks.filter((b) => b.start >= anchor).map((b) => b.start),
      );
      const lead = capsFor(Math.floor(anchor - lower), [0, 1, 2]);
      const tail = capsFor(Math.floor(upper - anchor), [3, 4]);
      if (!lead || !tail) continue;
      const caps = [...lead, ...tail],
        key = caps.join(",");
      const group = groups.get(key) ?? { caps, offsets: [] };
      group.offsets.push(offset);
      groups.set(key, group);
    }
    return [...groups.values()].map(({ caps, offsets }) => ({
      ...directionTimingSchema,
      properties: {
        ...directionTimingSchema.properties,
        anchorLyricId: { type: "integer", enum: [line.id] },
        anchorOffset: { type: "integer", enum: offsets },
        stages: {
          ...stageSchema,
          properties: Object.fromEntries(
            cinematicPhases.map((phase, i) => [
              phase,
              {
                ...stageSchema.properties[phase],
                properties: {
                  ...stageSchema.properties[phase].properties,
                  seconds: {
                    type: "integer",
                    enum: ranges[i].filter((n) => n <= caps[i]),
                  },
                },
              },
            ]),
          ),
        },
      },
    }));
  });
}
/** Timing is a compiler responsibility. The model selects semantic moments; the
 * scheduler allocates legal reveal/hold/release intervals around those moments.
 * No song percentages, energy ranking or example-specific timing. */
export function scheduleCreativeWindows(
  brief: CreativeBrief,
  selections: readonly (string | { beatId: string; timing: DirectionTiming })[],
): CreativeSlot[] {
  const ids = selections.map((s) => (typeof s === "string" ? s : s.beatId));
  if (ids.length > 2 || new Set(ids).size !== ids.length)
    throw Error("请选不重复的一至两个语义记忆点");
  const duration = brief.beats.at(-1)?.end ?? 0;
  if (duration < 12) throw Error("片段不足12秒，暂不安排完整驻足桥段");
  const slots = ids
    .map((id, index): CreativeSlot => {
      const beat = brief.beats.find((b) => b.id === id);
      if (!beat || beat.direction.locked) throw Error("记忆点引用无效或已锁定");
      const selection = selections[index];
      if (typeof selection !== "string") {
        const timing = validateDirectionTiming(selection.timing);
        const line = (beat.evidence?.lyrics ?? beat.citedLyrics).find(
          (l) => l.id === timing.anchorLyricId,
        );
        if (timing.anchorLyricId && !line)
          throw Error("揭示锚点必须引用本段歌词");
        const timestamp =
          line && "start" in line && typeof line.start === "number"
            ? line.start
            : undefined;
        const anchor =
          Math.max(beat.start, timestamp ?? beat.start) + timing.anchorOffset;
        if (anchor >= beat.end) throw Error("揭示锚点超出叙事时间窗");
        const preparation = timing.stages
          .slice(0, 3)
          .reduce((sum, s) => sum + s.seconds, 0);
        let cursor = 0;
        const stages = timing.stages.map((s) => {
          const start = cursor;
          cursor += s.seconds;
          return { phase: s.phase, start, end: cursor, purpose: s.purpose };
        });
        const start = anchor - preparation,
          end = start + cursor;
        if (start < 0 || end > duration)
          throw Error(
            `导演时序超出片段：揭示${anchor.toFixed(1)}秒需要前置${preparation}秒、后续${cursor - preparation}秒；请调整锚点或阶段时长，不移动歌词时钟`,
          );
        return {
          beatId: id,
          start,
          end,
          anchor,
          score: {
            version: 1,
            technique: timing.technique,
            stages,
            anchor: {
              time: anchor,
              lyricId: timing.anchorLyricId,
              precision: timestamp === undefined ? "window" : "lyric",
            },
          },
        };
      }
      const anchor = (beat.start + beat.end) / 2,
        length = Math.min(28, Math.max(12, beat.end - beat.start), duration);
      const start = Math.max(
        0,
        Math.min(duration - length, anchor - length / 2),
      );
      return { beatId: id, anchor, start, end: start + length };
    })
    .sort((a, b) => a.anchor - b.anchor);
  if (slots.length === 2 && slots[0].end + 2 > slots[1].start) {
    if (slots.some((s) => s.score))
      throw Error("导演桥段重叠，请合并记忆点或调整时序，不能截掉已承诺的阶段");
    const boundary = (slots[0].anchor + slots[1].anchor) / 2;
    slots[0].end = Math.min(slots[0].end, boundary - 1);
    slots[1].start = Math.max(slots[1].start, boundary + 1);
  }
  for (const slot of slots) {
    if (slot.end - slot.start < 12)
      throw Error("两个记忆点过近，请合并为一个，保留充足铺垫和余韵");
    if (
      brief.beats.some(
        (b) => b.direction.locked && slot.start < b.end && slot.end > b.start,
      )
    )
      throw Error("记忆点的动作区间跨越人工锁定，请改选其他段落");
  }
  return slots;
}
