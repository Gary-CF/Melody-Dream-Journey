import { test } from "node:test";
import assert from "node:assert/strict";
import { defaults, validatePlan } from "../src/model.ts";
import {
  applyDraft,
  createDraft,
  evidenceFor,
  importStructure,
  inputKey,
  isStale,
} from "../src/narrative.ts";

test("draft creation is isolated from the live plan and ignores song filename", () => {
  const p = defaults(),
    before = structuredClone(p);
  const a = createDraft(p);
  assert.deepEqual(p, before);
  p.audio.name = "成都.mp3";
  assert.deepEqual(a, createDraft(p));
  assert.equal(a.provider, "existing-plan");
  assert.equal(a.segments[0].label, "当前章节");
});
test("structure JSON uses whole-song coordinates exactly once and fills uncovered gaps", () => {
  const p = defaults();
  p.audio.duration = 160;
  p.audio.clipStart = 20;
  p.audio.clipEnd = 100;
  const s = importStructure(
    {
      segments: [
        { start: 0, end: 40, label: "verse" },
        { start: 60, end: 120, label: "outro" },
      ],
      beats: [25, 65],
    },
    p,
  );
  const d = createDraft(p, s);
  assert.deepEqual(
    d.segments.map((s) => [s.start, s.end, s.label]),
    [
      [0, 20, "verse"],
      [20, 40, "unlabeled"],
      [40, 80, "outro"],
    ],
  );
  assert.equal(d.segments[2].intent, "farewell");
  assert.equal(d.structure?.beats[0], 25);
});
test("locked user direction survives changed structural boundaries on same audio", () => {
  const p = defaults();
  p.narrative = createDraft(p);
  const first = p.narrative.segments[0];
  first.locked = true;
  first.note = "保留静谧";
  first.atmosphere = "dusk";
  const s = importStructure(
    {
      segments: [
        { start: 0, end: 15, label: "intro" },
        { start: 15, end: 120, label: "verse" },
      ],
    },
    p,
  );
  const next = createDraft(p, s);
  assert.deepEqual(next.segments[0], first);
  assert.ok(next.segments.slice(1).every((s) => s.start >= first.end));
  p.audio.fingerprint = "different";
  const different = createDraft(p);
  assert.equal(
    different.segments.some((s) => s.locked),
    false,
  );
  assert.equal(different.structure, undefined);
});
test("stale lyric or clip inputs block application; refresh preserves compatible locks", () => {
  const p = defaults();
  p.narrative = createDraft(p);
  p.narrative.segments[0].locked = true;
  p.narrative.segments[0].note = "判断";
  p.lyrics.lines = [{ start: 0, end: 15, text: "用于同步测试的文本" }];
  assert.ok(isStale(p));
  assert.throws(() => applyDraft(p), /更新/);
  p.narrative = createDraft(p);
  assert.equal(p.narrative.segments[0].note, "判断");
  assert.equal(isStale(p), false);
  p.audio.clipStart = 10;
  assert.ok(isStale(p));
  assert.doesNotThrow(() => validatePlan(p));
});
test("applying a quiet ending changes intended atmosphere without rewriting audio or guessing camera", () => {
  const p = defaults();
  p.narrative = createDraft(p);
  const s = p.narrative.segments.at(-1)!;
  s.intent = "farewell";
  s.atmosphere = "night";
  s.view = "first";
  s.title = "留一点暖光";
  const next = validatePlan(applyDraft(p));
  assert.deepEqual(next.audio, p.audio);
  assert.deepEqual(next.lyrics, p.lyrics);
  assert.deepEqual(next.path, p.path);
  assert.equal(next.chapters.at(-1)?.atmosphere, "night");
  assert.equal(next.chapters.at(-1)?.moment?.kind, "none");
  assert.ok(next.chapters.at(-1)?.director?.view === "first");
  assert.deepEqual(
    validatePlan(JSON.parse(JSON.stringify(next))).narrative,
    p.narrative,
  );
});
test("evidence leaves missing energy unknown and translates song/clip lyrics accurately", () => {
  const p = defaults();
  p.audio.duration = 160;
  p.audio.clipStart = 40;
  p.audio.clipEnd = 120;
  p.lyrics.lines = [{ start: 45, end: 50, text: "证据文本" }];
  const signal = { energy: Array(160).fill(0.4), step: 1 };
  const s = { start: 0, end: 12 };
  assert.equal(evidenceFor(p, s, signal).lyrics[0].start, 5);
  assert.ok(Math.abs(evidenceFor(p, s, signal).mean! - 0.4) < 1e-8);
  assert.equal(evidenceFor(p, s, { energy: [], step: 1 }).mean, null);
  p.lyrics.basis = "clip";
  p.lyrics.lines[0].start = 5;
  p.lyrics.lines[0].end = 10;
  assert.equal(evidenceFor(p, s, signal).lyrics[0].start, 5);
});
test("malformed structure and imported draft cannot bypass time/reference validation", () => {
  const p = defaults();
  for (const value of [
    { segments: [] },
    { segments: [{ start: 0, end: 130, label: "verse" }] },
    {
      segments: [
        { start: 0, end: 30, label: "a" },
        { start: 20, end: 40, label: "b" },
      ],
    },
    { segments: [{ start: 0, end: 120, label: "a" }], beats: [2, 1] },
  ])
    assert.throws(() => importStructure(value, p));
  p.narrative = createDraft(p);
  for (const mutate of [
    (d: any) => (d.segments[0].view = "execute"),
    (d: any) => (d.segments[0].end = 5000),
    (d: any) => (d.segments[0].atmosphere = "missing"),
    (d: any) => (d.segments[0].intent = "toString"),
  ]) {
    const next = structuredClone(p);
    mutate(next.narrative);
    assert.throws(() => validatePlan(next));
  }
});
test("manual title changes do not invalidate audio analysis revision", () => {
  const p = defaults();
  const key = inputKey(p);
  p.chapters[0].title = "人工标题";
  assert.equal(inputKey(p), key);
  p.lyrics.offset = 1;
  assert.notEqual(inputKey(p), key);
});
