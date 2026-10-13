import { travelledAt, type Segment } from "../path";

export interface DecorationWindow {
  id: string;
  start: number;
  end: number;
}
/** Lighting or narration cuts must not spawn another copy of the same scenery. */
export function decorationWindows(
  chapters: readonly { start: number; recipes?: readonly string[] }[],
  end: number,
): DecorationWindow[] {
  const result: DecorationWindow[] = [],
    last = new Map<string, DecorationWindow>();
  chapters.forEach((chapter, index) => {
    const until = chapters[index + 1]?.start ?? end;
    for (const id of new Set(chapter.recipes ?? [])) {
      const previous = last.get(id);
      if (previous && Math.abs(previous.end - chapter.start) < 1e-6)
        previous.end = until;
      else {
        const window = { id, start: chapter.start, end: until };
        result.push(window);
        last.set(id, window);
      }
    }
  });
  return result;
}
/** Sample physical distance, not elapsed time: a musical pause doesn't pile up props. */
export function decorationSites(
  path: Segment[],
  window: DecorationWindow,
  radius: number,
  density: number,
) {
  const start = travelledAt(path, window.start),
    end = travelledAt(path, window.end);
  const spacing = Math.max(20, radius * 2.3 + 10) / Math.max(0.2, density);
  const count = Math.min(20, Math.max(1, Math.floor((end - start) / spacing)));
  return Array.from({ length: count }, (_, index) => {
    const distance = start + ((index + 0.5) / count) * (end - start);
    const segment =
      path.find((s) => distance <= s.distanceStart + s.length) ?? path.at(-1)!;
    const progress = Math.max(
      0,
      Math.min(segment.length, distance - segment.distanceStart),
    );
    return {
      x: segment.a.x + segment.dx * progress,
      z: segment.a.z + segment.dz * progress,
      dx: segment.dx,
      dz: segment.dz,
    };
  });
}
