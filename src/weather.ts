import type { Plan } from "./model";
import { smooth } from "./director";
import {
  validateWeatherEvidence,
  isCurrentWeatherFact,
  type WeatherEvidence,
} from "./domain/weather-evidence";
export const weatherNames = {
  clear: "晴朗",
  cloudy: "阴天",
  drizzle: "细雨",
  rain: "雨幕",
  mist: "薄雾",
  afterRain: "雨后",
} as const;
export type WeatherKind = keyof typeof weatherNames;
export interface WeatherCue {
  scope?: WeatherEvidence;
  kind: WeatherKind;
  intensity: number;
  context: "present" | "memory" | "dream" | "metaphor" | "unspecified";
  evidence: string;
}
export interface WeatherState {
  rain: number;
  cloud: number;
  fog: number;
  wet: number;
}
const states: Record<WeatherKind, WeatherState> = {
  clear: { rain: 0, cloud: 0, fog: 0, wet: 0 },
  cloudy: { rain: 0, cloud: 0.8, fog: 0.2, wet: 0 },
  drizzle: { rain: 0.4, cloud: 0.65, fog: 0.35, wet: 0.7 },
  rain: { rain: 1, cloud: 0.95, fog: 0.6, wet: 1 },
  mist: { rain: 0, cloud: 0.35, fog: 1, wet: 0.25 },
  afterRain: { rain: 0, cloud: 0.25, fog: 0.25, wet: 0.85 },
};
export function validateWeather(value: unknown): WeatherCue {
  const v = value as WeatherCue;
  if (
    !v ||
    !Object.hasOwn(weatherNames, v.kind) ||
    !Number.isFinite(v.intensity) ||
    v.intensity < 0 ||
    v.intensity > 1 ||
    !["present", "memory", "dream", "metaphor", "unspecified"].includes(
      v.context,
    ) ||
    typeof v.evidence !== "string" ||
    v.evidence.length > 500
  )
    throw Error("天气字段无效");
  if (v.scope !== undefined) {
    const s = validateWeatherEvidence(v.scope);
    const literal =
      s.temporal === "present" &&
      s.reality === "physical" &&
      s.polarity === "affirmed" &&
      s.presentation === "literal";
    const evoked =
      ["memory", "dream"].includes(s.reality) &&
      s.polarity === "affirmed" &&
      s.presentation === "evoked";
    if (v.kind !== "clear" && !(literal || evoked))
      throw Error("天气执行与叙述范围冲突");
    if (v.context === "present" && !isCurrentWeatherFact(s, v.kind))
      throw Error("当前天气缺少现实范围支持");
  }
  return v;
}
export function weatherState(cue?: WeatherCue): WeatherState {
  const preset = states[cue?.kind ?? "clear"];
  const strength = cue?.intensity ?? 1;
  return Object.fromEntries(
    Object.entries(preset).map(([k, v]) => [k, v * strength]),
  ) as unknown as WeatherState;
}
// Fold all transitions at absolute music time; interrupted transitions never jump.
export function weatherAt(
  p: Plan,
  time: number,
  override?: WeatherKind,
): WeatherState {
  if (override) return { ...states[override] };
  let result = weatherState(p.chapters[0].weather);
  let previous = result;
  for (let i = 1; i < p.chapters.length; i++) {
    const c = p.chapters[i];
    if (time < c.start) break;
    const prior = p.chapters[i - 1];
    if (i > 1) {
      const blend = smooth(
        (c.start - prior.start) /
          (prior.director?.transition ?? p.transition.seconds),
      );
      previous = blendState(previous, weatherState(prior.weather), blend);
    }
    result = blendState(
      previous,
      weatherState(c.weather),
      smooth(
        (time - c.start) / (c.director?.transition ?? p.transition.seconds),
      ),
    );
  }
  return result;
}
function blendState(a: WeatherState, b: WeatherState, t: number): WeatherState {
  return {
    rain: a.rain + (b.rain - a.rain) * t,
    cloud: a.cloud + (b.cloud - a.cloud) * t,
    fog: a.fog + (b.fog - a.fog) * t,
    wet: a.wet + (b.wet - a.wet) * t,
  };
}
