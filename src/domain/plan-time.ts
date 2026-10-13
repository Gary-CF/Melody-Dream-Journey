import type { Plan, Lyric } from "../model";
export function duration(p: Plan) {
  return p.audio.clipEnd - p.audio.clipStart;
}
// Lyrics keep their original timestamp basis. Convert exactly once at this boundary.
export function lyricTime(line: Lyric, p: Plan) {
  return (
    line.start +
    p.lyrics.offset -
    (p.lyrics.basis === "song" ? p.audio.clipStart : 0)
  );
}
export function lyricEnd(line: Lyric, p: Plan) {
  return (
    line.end +
    p.lyrics.offset -
    (p.lyrics.basis === "song" ? p.audio.clipStart : 0)
  );
}
export function chapterAt(p: Plan, t: number) {
  return p.chapters.filter((c) => c.start <= t).at(-1) ?? p.chapters[0];
}
