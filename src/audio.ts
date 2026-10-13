import type { MusicEvent } from "./model";
export interface Analysis {
  frames?: import("./music-features").MusicFrame[];
  energy: number[];
  step: number;
  events: MusicEvent[];
}
export class Player {
  audio = new Audio();
  analysis: Analysis = { energy: [], step: 1, events: [] };
  loaded = false;
  private loadedFingerprint = "";
  get fingerprint() {
    return this.loadedFingerprint;
  }
  playing = false;
  clipStart = 0;
  clipEnd = 120;
  private anchor = 0;
  private pausedAt = 0;
  private url = "";
  private worker?: Worker;
  private cancelAnalysis?: () => void;
  private generation = 0;
  private context?: AudioContext;
  private cache = new Map<string, Analysis>();
  constructor() {
    this.audio.preload = "auto";
    this.audio.volume = 0.6;
    this.audio.addEventListener("ended", () => {
      this.playing = false;
      this.pausedAt = this.clipEnd - this.clipStart;
    });
  }
  get time() {
    return Math.max(
      0,
      Math.min(
        this.clipEnd - this.clipStart,
        this.loaded
          ? this.audio.currentTime - this.clipStart
          : this.playing
            ? this.pausedAt + (performance.now() - this.anchor) / 1000
            : this.pausedAt,
      ),
    );
  }
  get energy() {
    return (
      this.analysis.energy[
        Math.floor((this.time + this.clipStart) / this.analysis.step)
      ] ?? 0
    );
  }
  async play() {
    if (this.time >= this.clipEnd - this.clipStart - 0.05) this.seek(0);
    if (this.loaded) await this.audio.play();
    else this.anchor = performance.now();
    this.playing = true;
  }
  pause() {
    this.pausedAt = this.time;
    this.audio.pause();
    this.playing = false;
  }
  seek(t: number) {
    const time = Math.max(0, Math.min(this.clipEnd - this.clipStart, t));
    this.pausedAt = time;
    this.anchor = performance.now();
    if (this.loaded) this.audio.currentTime = this.clipStart + time;
  }
  setClip(start: number, end: number) {
    this.pause();
    this.clipStart = start;
    this.clipEnd = end;
    this.seek(0);
  }
  stopFile() {
    this.pause();
    this.generation++;
    this.worker?.terminate();
    this.worker = undefined;
    this.cancelAnalysis?.();
    this.cancelAnalysis = undefined;
    this.audio.removeAttribute("src");
    this.audio.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = "";
    this.loaded = false;
    this.loadedFingerprint = "";
    this.analysis = { energy: [], step: 1, events: [] };
    this.pausedAt = 0;
  }
  async load(file: File, status: (s: string) => void) {
    if (file.size > 160 * 1024 * 1024) throw Error("请选择小于 160 MB 的音频");
    this.stopFile();
    const gen = this.generation;
    status("正在解码本地音频…");
    const raw = await file.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", raw);
    const fingerprint = Array.from(new Uint8Array(hash))
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("");
    this.context ??= new AudioContext();
    const buffer = await this.context.decodeAudioData(raw);
    if (gen !== this.generation) throw Error("已取消旧音频加载");
    if (buffer.duration > 3600 || buffer.duration < 1)
      throw Error("支持 1 秒至 60 分钟的音频");
    let analysis = this.cache.get(fingerprint);
    if (!analysis) {
      status("正在后台分析分时段能量、音色和音高分布…");
      const channel = buffer.getChannelData(0);
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
        buffer.getChannelData(i),
      );
      const divisor = Math.max(1, Math.floor(buffer.sampleRate / 11025));
      const samples = new Float32Array(Math.ceil(channel.length / divisor));
      // Copy in chunks so decoding preparation cannot monopolize the UI thread.
      for (let offset = 0; offset < samples.length; offset += 65536) {
        for (
          let i = offset;
          i < Math.min(samples.length, offset + 65536);
          i++
        ) {
          let value = 0;
          for (let c = 0; c < buffer.numberOfChannels; c++)
            value += channels[c][i * divisor] ?? 0;
          samples[i] = value / buffer.numberOfChannels;
        }
        await new Promise((r) => setTimeout(r, 0));
        if (gen !== this.generation) throw Error("已取消旧音频加载");
      }
      analysis = await new Promise<Analysis>((resolve, reject) => {
        const worker = new Worker(
          new URL("./analysis.worker.ts", import.meta.url),
          { type: "module" },
        );
        this.worker = worker;
        this.cancelAnalysis = () => reject(Error("已取消旧音频分析"));
        worker.onmessage = (e) => {
          worker.terminate();
          this.worker = undefined;
          this.cancelAnalysis = undefined;
          resolve(e.data);
        };
        worker.onerror = () => {
          worker.terminate();
          this.cancelAnalysis = undefined;
          reject(Error("音频分析失败，请尝试 WAV 文件"));
        };
        worker.postMessage(
          { samples, sampleRate: buffer.sampleRate / divisor },
          [samples.buffer],
        );
      });
      if (gen !== this.generation) throw Error("已取消旧音频加载");
      this.cache.set(fingerprint, analysis);
      if (this.cache.size > 3)
        this.cache.delete(this.cache.keys().next().value!);
    }
    this.analysis = analysis;
    this.url = URL.createObjectURL(file);
    this.audio.src = this.url;
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this.audio.removeEventListener("loadedmetadata", ready);
        this.audio.removeEventListener("error", error);
        this.cancelAnalysis = undefined;
      };
      const ready = () => {
        cleanup();
        resolve();
      };
      const error = () => {
        cleanup();
        reject(Error("浏览器无法播放该文件"));
      };
      this.cancelAnalysis = () => {
        cleanup();
        reject(Error("已取消旧音频加载"));
      };
      this.audio.addEventListener("loadedmetadata", ready, { once: true });
      this.audio.addEventListener("error", error, { once: true });
    });
    if (gen !== this.generation) throw Error("已取消旧音频加载");
    this.loaded = true;
    this.loadedFingerprint = fingerprint;
    this.setClip(0, buffer.duration);
    status("本地音频已就绪 · 不上传文件");
    return { duration: buffer.duration, fingerprint };
  }
  tick() {
    if (this.playing && this.time >= this.clipEnd - this.clipStart - 0.015) {
      this.pause();
      this.seek(this.clipEnd - this.clipStart);
    }
  }
}
