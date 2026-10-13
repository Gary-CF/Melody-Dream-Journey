/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;
import { musicFrames } from "./music-features";
self.onmessage = (
  message: MessageEvent<{ samples: Float32Array; sampleRate: number }>,
) => {
  const { samples, sampleRate } = message.data,
    hop = 512,
    size = 1024,
    step = hop / sampleRate;
  const rms: number[] = [],
    onset: number[] = [];
  let base = 0,
    smooth = 0,
    max = 0;
  for (let offset = 0; offset < samples.length; offset += hop) {
    let sum = 0;
    for (let j = offset; j < Math.min(samples.length, offset + size); j++)
      sum += samples[j] * samples[j];
    const value = Math.sqrt(sum / size);
    smooth = 0.72 * smooth + 0.28 * value;
    rms.push(smooth);
    const flux = Math.max(0, value - base * 1.25);
    onset.push(flux);
    base = 0.86 * base + 0.14 * value;
    max = Math.max(max, flux);
  }
  const energyMax = Math.max(0.00001, ...rms.filter((_, i) => i % 4 === 0));
  const events: {
    time: number;
    strength: number;
    kind: "onset";
    enabled: boolean;
  }[] = [];
  let last = -1;
  for (let i = 2; i < onset.length - 2; i++) {
    const strength = max ? onset[i] / max : 0;
    if (
      strength > 0.12 &&
      onset[i] >= onset[i - 1] &&
      onset[i] > onset[i + 1] &&
      i * step - last > 0.2
    ) {
      events.push({ time: i * step, strength, kind: "onset", enabled: true });
      last = i * step;
    }
  }
  self.postMessage({
    frames: musicFrames(samples, sampleRate),
    energy: rms.map((n) => Math.min(1, n / energyMax)),
    step,
    events:
      events.length > 10000
        ? events
            .sort((a, b) => b.strength - a.strength)
            .slice(0, 10000)
            .sort((a, b) => a.time - b.time)
        : events,
  });
};
