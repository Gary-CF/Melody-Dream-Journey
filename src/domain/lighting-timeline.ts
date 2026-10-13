import type { Atmosphere } from "../design";
import { lightProgress } from "../director";

export type LinearColor = [number, number, number];
const colorKeys = ["sky", "water", "ground", "light", "accent"] as const;
export type LightFrame = Record<(typeof colorKeys)[number], LinearColor> & {
  night: number;
  sun: number;
  fog: number;
  sparkle: number;
  exposure: number;
  sunElevation: number;
  sunAzimuth: number;
};
export interface LightingEvent {
  start: number;
  atmosphere?: string;
  director?: { transition: number };
}
export interface LightingCue {
  start: number;
  seconds: number;
  from: LightFrame;
  to: LightFrame;
}
const linear = (n: number) =>
  n <= 0.04045 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
export const linearColor = (hex: string): LinearColor =>
  [1, 3, 5].map((i) =>
    linear(parseInt(hex.slice(i, i + 2), 16) / 255),
  ) as LinearColor;
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const frame = (a: Atmosphere): LightFrame => ({
  sky: linearColor(a.sky),
  water: linearColor(a.water),
  ground: linearColor(a.ground),
  light: linearColor(a.light),
  accent: linearColor(a.accent),
  night: a.night,
  sun: a.sun,
  fog: a.fog,
  sparkle: a.sparkle,
  exposure: a.exposure,
  sunElevation: a.sunElevation ?? 10,
  sunAzimuth: a.sunAzimuth ?? -170.54,
});
function evaluate(cue: LightingCue, time: number): LightFrame {
  const progress = lightProgress(time - cue.start, cue.seconds),
    a = cue.from,
    b = cue.to;
  const colors = Object.fromEntries(
    colorKeys.map((key) => [
      key,
      a[key].map((v, i) =>
        mix(v, b[key][i], key === "light" ? progress.key : progress.sky),
      ),
    ]),
  ) as Record<(typeof colorKeys)[number], LinearColor>;
  return {
    ...colors,
    night: mix(a.night, b.night, progress.lamps),
    sun: mix(a.sun, b.sun, progress.key),
    fog: mix(a.fog, b.fog, progress.sky),
    sparkle: mix(a.sparkle, b.sparkle, progress.sky),
    exposure: mix(a.exposure, b.exposure, progress.exposure),
    sunElevation: mix(a.sunElevation, b.sunElevation, progress.key),
    sunAzimuth:
      a.sunAzimuth +
      (((((b.sunAzimuth - a.sunAzimuth) % 360) + 540) % 360) - 180) *
        progress.key,
  };
}
/** Each new cue starts from the actual interrupted value, not the preceding target.
 * Absolute-time evaluation gives identical light after seeking or continuous playback. */
export function compileLighting(
  events: readonly LightingEvent[],
  palettes: readonly Atmosphere[],
  defaultSeconds: number,
): LightingCue[] {
  if (!events.length || !palettes.length)
    throw Error("光影时间线缺少事件或氛围");
  const sorted = [...events].sort((a, b) => a.start - b.start),
    result: LightingCue[] = [];
  for (const event of sorted) {
    const target = frame(
      palettes.find((a) => a.id === event.atmosphere) ?? palettes[0],
    );
    if (!Number.isFinite(event.start) || event.start < 0)
      throw Error("光影事件时间无效");
    const seconds = event.director?.transition ?? defaultSeconds;
    if (!Number.isFinite(seconds) || seconds <= 0)
      throw Error("光影渐变时长无效");
    const from = result.length ? evaluate(result.at(-1)!, event.start) : target;
    result.push({ start: event.start, seconds, from, to: target });
  }
  return result;
}
export function lightingAt(
  cues: readonly LightingCue[],
  time: number,
): LightFrame {
  if (!cues.length || !Number.isFinite(time)) throw Error("光影采样无效");
  let index = 0;
  for (let i = 1; i < cues.length && cues[i].start <= time; i++) index = i;
  return evaluate(cues[index], time);
}
