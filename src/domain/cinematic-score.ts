import { array, choice, number, object, text } from "./creative-validation";

export const cinematicPhases = [
  "approach",
  "buildup",
  "reveal",
  "hold",
  "release",
] as const;
export type CinematicPhase = (typeof cinematicPhases)[number];
export const phaseNames: Record<CinematicPhase, string> = {
  approach: "接近",
  buildup: "铺垫",
  reveal: "揭示",
  hold: "停留",
  release: "余韵",
};
export interface DirectionTiming {
  anchorLyricId: number;
  anchorOffset: number;
  stages: { phase: CinematicPhase; seconds: number; purpose: string }[];
  technique: "lift" | "open" | "settle";
}
/** Semantic direction is fixed before production chooses legal clock durations. */
export interface DirectionStaging {
  technique: DirectionTiming["technique"];
  stages: Record<CinematicPhase, string>;
}
export function validateDirectionStaging(raw: unknown): DirectionStaging {
  const value = object(raw),
    stages = object(value.stages);
  return {
    technique: choice(
      value.technique,
      ["lift", "open", "settle"] as const,
      "观看方式",
    ),
    stages: Object.fromEntries(
      cinematicPhases.map((phase) => [
        phase,
        text(stages[phase], "阶段观看目的", 160),
      ]),
    ) as DirectionStaging["stages"],
  };
}
/** All times are local seconds from the sequence start. Geometry never moves per shot. */
export interface CinematicScore {
  version: 1;
  technique: DirectionTiming["technique"];
  stages: {
    phase: CinematicPhase;
    start: number;
    end: number;
    purpose: string;
  }[];
  anchor: { time: number; lyricId: number; precision: "lyric" | "window" };
}
export const directionTimingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    anchorLyricId: { type: "integer", minimum: 0 },
    anchorOffset: { type: "number", minimum: 0, maximum: 30 },
    technique: { type: "string", enum: ["lift", "open", "settle"] },
    stages: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        cinematicPhases.map((phase, index) => [
          phase,
          {
            type: "object",
            additionalProperties: false,
            properties: {
              seconds: {
                type: "integer",
                enum: Array.from(
                  {
                    length:
                      [8, 8, 6, 10, 8][index] - [2, 2, 2, 3, 3][index] + 1,
                  },
                  (_, n) => n + [2, 2, 2, 3, 3][index],
                ),
              },
              purpose: { type: "string", maxLength: 160 },
            },
            required: ["seconds", "purpose"],
          },
        ]),
      ),
      required: cinematicPhases,
    },
  },
  required: ["anchorLyricId", "anchorOffset", "technique", "stages"],
} as const;
export function validateDirectionTiming(raw: unknown): DirectionTiming {
  const r = object(raw);
  const anchorLyricId = number(r.anchorLyricId, "揭示歌词锚点", 0, 100000);
  if (!Number.isInteger(anchorLyricId)) throw Error("揭示歌词锚点无效");
  // Named generation slots prevent missing/repeated phases. Stored scores retain
  // the ordered array contract, including already archived directions.
  const supplied = Array.isArray(r.stages)
    ? r.stages
    : cinematicPhases.map((phase) => ({
        ...object(object(r.stages)[phase]),
        phase,
      }));
  const stages = array(supplied, "五阶段导演时序", 5, 5).map((v, i) => {
    const s = object(v);
    if (s.phase !== cinematicPhases[i])
      throw Error("五阶段必须按接近、铺垫、揭示、停留、余韵排列");
    return {
      phase: cinematicPhases[i],
      seconds: number(s.seconds, "阶段秒数", 1, 16),
      purpose: text(s.purpose, "阶段观看目的", 160),
    };
  });
  const total = stages.reduce((sum, s) => sum + s.seconds, 0);
  if (total < 12 || total > 40)
    throw Error("完整导演桥段需要12至40秒，请按乐句调整阶段时长");
  return {
    anchorLyricId,
    anchorOffset: number(r.anchorOffset, "锚点偏移", 0, 30),
    technique: choice(
      r.technique,
      ["lift", "open", "settle"] as const,
      "观看方式",
    ),
    stages,
  };
}
export function validateCinematicScore(raw: unknown): CinematicScore {
  const r = object(raw);
  if (r.version !== 1) throw Error("导演时序版本无效");
  let end = 0;
  const stages = array(r.stages, "导演阶段", 5, 5).map((value, i) => {
    const s = object(value);
    if (s.phase !== cinematicPhases[i] || s.start !== end)
      throw Error("导演阶段必须连续且有序");
    const start = end;
    end = number(s.end, "阶段结束", start + 1, start + 16);
    return {
      phase: cinematicPhases[i],
      start,
      end,
      purpose: text(s.purpose, "阶段目的", 160),
    };
  });
  if (end < 12 || end > 40) throw Error("导演时序总长无效");
  const a = object(r.anchor),
    lyricId = number(a.lyricId, "导演歌词锚点", 0, 100000);
  if (!Number.isInteger(lyricId)) throw Error("导演歌词锚点无效");
  return {
    version: 1,
    technique: choice(
      r.technique,
      ["lift", "open", "settle"] as const,
      "观看方式",
    ),
    stages,
    anchor: {
      time: number(a.time, "导演锚点", 0, 3600),
      lyricId,
      precision: choice(a.precision, ["lyric", "window"] as const, "锚点精度"),
    },
  };
}
const smooth = (t: number) => {
  const u = Math.max(0, Math.min(1, t));
  return u * u * (3 - 2 * u);
};
export function scoreFrame(score: CinematicScore, seconds: number) {
  const [approach, buildup, reveal, hold, release] = score.stages;
  const stage = score.stages.find((s) => seconds < s.end) ?? release;
  const revealWeight =
    smooth((seconds - reveal.start) / (reveal.end - reveal.start)) *
    (1 - smooth((seconds - release.start) / (release.end - release.start)));
  const attention =
    smooth((seconds - buildup.start) / (reveal.end - buildup.start)) *
    (1 - smooth((seconds - release.start) / (release.end - release.start)));
  const movement =
    seconds < approach.end
      ? 1
      : seconds < reveal.end
        ? 1 - smooth((seconds - approach.end) / (reveal.end - approach.end))
        : seconds <= hold.end
          ? 0
          : smooth((seconds - release.start) / (release.end - release.start));
  return {
    phase: stage.phase,
    reveal: revealWeight,
    attention,
    movement,
    holdProgress: Math.max(
      0,
      Math.min(1, (seconds - hold.start) / (hold.end - hold.start)),
    ),
  };
}
