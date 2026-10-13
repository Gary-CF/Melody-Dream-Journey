// Windowed spectral evidence, not vocal transcription or lead-melody extraction.
export interface MusicFrame {
  time: number;
  rms: number;
  brightness: number;
  chroma: number[];
  pitch: number | null;
  pitchClarity: number;
}
function spectrum(samples: Float32Array, offset: number, size: number) {
  const re = new Float64Array(size),
    im = new Float64Array(size);
  for (let i = 0; i < size; i++)
    re[i] =
      (samples[offset + i] ?? 0) *
      (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) [re[i], re[j]] = [re[j], re[i]];
  }
  for (let n = 2; n <= size; n *= 2) {
    const angle = (-2 * Math.PI) / n;
    for (let base = 0; base < size; base += n)
      for (let k = 0; k < n / 2; k++) {
        const c = Math.cos(angle * k),
          s = Math.sin(angle * k),
          a = base + k,
          b = a + n / 2;
        const r = re[b] * c - im[b] * s,
          v = re[b] * s + im[b] * c;
        re[b] = re[a] - r;
        im[b] = im[a] - v;
        re[a] += r;
        im[a] += v;
      }
  }
  return re.slice(0, size / 2).map((v, i) => Math.hypot(v, im[i]));
}
export function musicFrames(
  samples: Float32Array,
  sampleRate: number,
): MusicFrame[] {
  const result: MusicFrame[] = [],
    size = 2048,
    hop = Math.round(sampleRate / 2);
  for (let offset = 0; offset < samples.length; offset += hop) {
    const spec = spectrum(samples, offset, size),
      chroma = Array<number>(12).fill(0);
    let mass = 0,
      centroid = 0,
      peak = 0,
      peakBin = 0,
      tonalMass = 0,
      sum = 0;
    for (let j = offset; j < Math.min(samples.length, offset + size); j++)
      sum += samples[j] ** 2;
    for (let k = 1; k < spec.length; k++) {
      const hz = (k * sampleRate) / size,
        value = spec[k];
      mass += value;
      centroid += hz * value;
      if (hz >= 65 && hz <= 2093) {
        const note = Math.round(69 + 12 * Math.log2(hz / 440));
        chroma[((note % 12) + 12) % 12] += value;
        tonalMass += value;
        if (value > peak) {
          peak = value;
          peakBin = k;
        }
      }
    }
    const rms = Math.sqrt(sum / size),
      norm = Math.hypot(...chroma) || 1;
    result.push({
      time: offset / sampleRate,
      rms,
      brightness: mass ? centroid / mass : 0,
      chroma: chroma.map((v) => v / norm),
      pitch:
        rms > 0.001 && peakBin
          ? 69 + 12 * Math.log2((peakBin * sampleRate) / size / 440)
          : null,
      pitchClarity: tonalMass ? peak / tonalMass : 0,
    });
  }
  return result;
}
