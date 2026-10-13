import { planSong } from "../src/planner.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  parseLrc,
  lyricTime,
  lyricEnd,
  validatePlan,
  selectTurns,
  rng,
} from "../src/model.ts";
import { makePath, positionAt } from "../src/path.ts";
test("LRC supports multiple timestamps, metadata offset and ordered end times", () => {
  const l = parseLrc(
    "[ar:Test]\n[offset:500]\n[00:12.25][00:20.00]同一片段\n[00:05.00]开场",
    30,
  );
  assert.deepEqual(
    l.map((l) => l.start),
    [5.5, 12.75, 20.5],
  );
  assert.deepEqual(
    l.map((l) => l.end),
    [12.75, 20.5, 30],
  );
});
test("song and clip lyric bases apply clip start exactly once", () => {
  const p = defaults();
  p.audio.clipStart = 30;
  p.audio.clipEnd = 80;
  p.lyrics.offset = 2;
  const l = { start: 40, end: 50, text: "河岸" };
  assert.equal(lyricTime(l, p), 12);
  assert.equal(lyricEnd(l, p), 22);
  p.lyrics.basis = "clip";
  assert.equal(lyricTime({ ...l, start: 10 }, p), 12);
});
test("seek and turn boundaries are continuous and speed remains constant", () => {
  const p = defaults(),
    path = makePath(p);
  for (const t of p.path.turnTimes) {
    const left = positionAt(path, t - 0.001),
      right = positionAt(path, t + 0.001);
    assert.ok(
      Math.hypot(left.x - right.x, left.z - right.z) <=
        p.path.speed * 0.002 + 1e-8,
    );
  }
  const a = positionAt(path, 4),
    b = positionAt(path, 9);
  assert.ok(
    Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - p.path.speed * 5) < 1e-9,
  );
  assert.deepEqual(positionAt(path, 42), positionAt(makePath(p), 42));
});
test("validation rejects malformed times, assets, huge counts and nonfinite values", () => {
  assert.deepEqual(
    validatePlan(JSON.parse(JSON.stringify(defaults()))),
    defaults(),
  );
  for (const mutate of [
    (p: any) => (p.audio.clipEnd = 200),
    (p: any) => (p.visual.height = Infinity),
    (p: any) => (p.chapters[0].assets = ["eval"]),
    (p: any) => (p.path.turnTimes = [20, 10]),
    (p: any) => (p.events = Array(10001).fill({})),
  ]) {
    const p = defaults();
    mutate(p);
    assert.throws(() => validatePlan(p));
  }
});
test("no keyword carries the current scene; rules and manual plans share the same schema", () => {
  const p = defaults();
  p.lyrics.lines = [
    { start: 0, end: 20, text: "平凡的一天" },
    { start: 20, end: 40, text: "河岸与小桥" },
    { start: 40, end: 60, text: "慢慢向前" },
  ];
  const c = planSong(p).chapters;
  assert.equal(c.length, 2);
  assert.equal(c[1].theme, "river");
  p.chapters = c;
  assert.doesNotThrow(() => validatePlan(p));
});
test("onset selection respects whole-song event timestamps, spacing and threshold", () => {
  const p = defaults();
  p.audio.clipStart = 30;
  p.audio.clipEnd = 90;
  p.path.minInterval = 10;
  p.path.threshold = 0.4;
  p.events = [
    { time: 42, strength: 0.8, kind: "onset", enabled: true },
    { time: 45, strength: 0.9, kind: "onset", enabled: true },
    { time: 56, strength: 0.6, kind: "onset", enabled: true },
  ];
  assert.deepEqual(selectTurns(p.events, p), [12, 26]);
});
test("fixed seed reproduces layout randomness", () => {
  const a = rng(233),
    b = rng(233);
  assert.deepEqual(
    Array.from({ length: 100 }, a),
    Array.from({ length: 100 }, b),
  );
});
