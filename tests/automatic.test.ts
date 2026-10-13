import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults, validatePlan } from "../src/model.ts";
import { musicFrames } from "../src/music-features.ts";
import {
  analyzeWindows,
  windowEvidence,
  automaticRequest,
  acousticFallback,
  assembleAutomatic,
  validateInterpretation,
} from "../src/auto-narrative.ts";
import { cameraPose, lightProgress } from "../src/director.ts";
const signal = {
  energy: Array.from({ length: 120 }, (_, i) =>
    i < 40 ? 0.2 : i < 80 ? 0.9 : 0.25,
  ),
  step: 1,
};
test("spectral evidence distinguishes synthetic pitch and silence without calling it lead melody", () => {
  const rate = 11025,
    samples = Float32Array.from(
      { length: rate * 2 },
      (_, i) =>
        Math.sin((2 * Math.PI * (i < rate ? 220 : 440) * i) / rate) * 0.3,
    );
  const f = musicFrames(samples, rate);
  assert.ok(Math.abs(f[0].pitch! - 57) < 1);
  assert.ok(Math.abs(f[2].pitch! - 69) < 1);
  assert.ok(f[2].brightness > f[0].brightness * 1.8);
  assert.equal(musicFrames(new Float32Array(rate), rate)[0].pitch, null);
});
test("boundaries respond to audio changes and lyrics use clip coordinates once", () => {
  const p = defaults(),
    w = analyzeWindows(p, signal);
  assert.ok(w.some((s) => Math.abs(s.start - 40) < 5));
  assert.ok(w.some((s) => Math.abs(s.start - 80) < 5));
  assert.equal(w[0].start, 0);
  assert.equal(w.at(-1)!.end, 120);
  for (let i = 1; i < w.length; i++) assert.equal(w[i].start, w[i - 1].end);
  p.audio.clipStart = 30;
  p.audio.clipEnd = 90;
  p.lyrics.lines = [{ start: 35, end: 43, text: "原创测试句" }];
  const e = windowEvidence(p, signal, 0, 15);
  assert.deepEqual(e.lyrics, [{ id: 1, text: "原创测试句", start: 5, end: 13 }]);
  p.lyrics.basis = "clip";
  p.lyrics.lines[0].start = 5;
  p.lyrics.lines[0].end = 13;
  assert.deepEqual(windowEvidence(p, signal, 0, 15), e);
});
test("automatic input excludes song identity and human residual, includes all temporal context", () => {
  const p = defaults();
  const a = automaticRequest(p, signal);
  p.audio.name = "成都.mp3";
  p.direction.keywords = "后期一盏灯";
  assert.deepEqual(automaticRequest(p, signal), a);
  assert.ok(a.windows.length > 1);
});
test("acoustic fallback is explicit and cannot claim lyric meanings or manufacture a night ending", () => {
  const p = defaults(),
    windows = analyzeWindows(p, signal),
    result = acousticFallback(p, windows);
  const next = validatePlan(
    assembleAutomatic(p, windows, result, "acoustic-fallback", "没有配置模型"),
  );
  assert.equal(next.narrative?.provider, "acoustic-fallback");
  assert.ok(next.chapters.every((c) => c.atmosphere === "day"));
  assert.ok(next.chapters.some((c) => c.director?.view !== "overhead"));
  assert.deepEqual(next.audio, p.audio);
  assert.deepEqual(next.narrative?.automatic?.baseline, result);
});
test("model responses must cover windows and cite actual local lyric evidence", () => {
  const p = defaults(),
    w = analyzeWindows(p, signal),
    r = acousticFallback(p, w);
  assert.doesNotThrow(() => validateInterpretation(r, p, w));
  const bad = structuredClone(r);
  bad.segments[0].lyricIds = [999];
  assert.throws(() => validateInterpretation(bad, p, w));
  bad.segments[0] = null as any;
  assert.throws(() => validateInterpretation(bad, p, w));
  bad.segments = r.segments.slice(1);
  assert.throws(() => validateInterpretation(bad, p, w));
  bad.segments = structuredClone(r.segments);
  bad.segments[0].view = "__proto__" as any;
  assert.throws(() => validateInterpretation(bad, p, w));
  bad.segments = structuredClone(r.segments);
  bad.segments[0].recipes = ["fabricated-model"];
  assert.throws(() => validateInterpretation(bad, p, w));
});
test("manual locks survive automatic re-analysis while old evidence is not misrepresented as fresh", () => {
  const p = defaults(),
    w = analyzeWindows(p, signal),
    r = acousticFallback(p, w);
  const a = assembleAutomatic(p, w, r, "semantic-model", "");
  a.narrative!.segments[0].locked = true;
  a.narrative!.segments[0].atmosphere = "night";
  a.lyrics.lines = [{ start: 0, end: 12, text: "不同的歌词证据" }];
  const w2 = analyzeWindows(a, signal),
    b = validatePlan(
      assembleAutomatic(
        a,
        w2,
        acousticFallback(a, w2),
        "acoustic-fallback",
        "",
      ),
    );
  assert.equal(b.narrative!.segments[0].atmosphere, "night");
  assert.equal(b.narrative!.segments[0].interpretation, undefined);
  assert.equal(b.chapters[0].source, "manual");
});
test("short clips, silence, old configs and deterministic camera/light tracks remain valid", () => {
  const p = defaults();
  p.audio.duration = 1;
  p.audio.clipEnd = 1;
  p.path.turnTimes = [];
  const w = analyzeWindows(p, { energy: [], step: 1 });
  assert.doesNotThrow(() =>
    validatePlan(
      assembleAutomatic(p, w, acousticFallback(p, w), "acoustic-fallback", ""),
    ),
  );
  const pose = cameraPose("eye", { x: 3, z: 8 }, { x: 0, z: 1 }, 0.4);
  assert.deepEqual(
    pose,
    cameraPose("eye", { x: 3, z: 8 }, { x: 0, z: 1 }, 0.4),
  );
  const start = lightProgress(0, 10),
    mid = lightProgress(5, 10),
    end = lightProgress(10, 10);
  assert.equal(start.lamps, 0);
  assert.ok(mid.lamps > 0 && mid.lamps < 1);
  assert.notEqual(mid.lamps, mid.sky);
  assert.equal(end.lamps, 1);
});
