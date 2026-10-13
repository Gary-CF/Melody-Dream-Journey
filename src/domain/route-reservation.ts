import {
  routeOffset,
  routeProfile,
  hasDetour,
  travelledAt,
  type Segment,
} from "../path";
import { reserveCubic, type Sweep, type Vec3 } from "./spatial";

export interface RouteBody {
  radius: number;
  height: number;
  groundY: number;
}
/** Reserve the actual spatial curve, independent of frame rate and song tempo.
 * Linear base travel plus smoothstep lateral detours are piecewise cubics.
 * Time ranges deliberately enclose pauses, rather than claim an exact hit time.
 */
export function reserveRoute(path: Segment[], body: RouteBody): Sweep[] {
  if (
    !path.length ||
    !Object.values(body).every(Number.isFinite) ||
    body.radius < 0 ||
    body.height <= 0
  )
    throw Error("Invalid route body");
  const result: Sweep[] = [];
  const end = path.at(-1)!.end;
  const timeAt = (distance: number, last: boolean) => {
    let lo = 0,
      hi = end;
    for (let i = 0; i < 50; i++) {
      const m = (lo + hi) / 2;
      const d = travelledAt(path, m);
      if (last ? d <= distance + 1e-9 : d < distance - 1e-9) lo = m;
      else hi = m;
    }
    return last ? hi : lo;
  };
  path.forEach((s, index) => {
    const low = s.distanceStart,
      high = low + s.length;
    const detours = (s.sequences ?? [])
      .filter((q) => hasDetour(q) && q.start < s.end && q.end > s.start)
      .map((q) => ({ q, ...routeProfile(path, q) }));
    const cuts = [low, high];
    for (const d of detours)
      cuts.push(
        ...[
          d.center - d.outer,
          d.center - d.inner,
          d.center,
          d.center + d.inner,
          d.center + d.outer,
        ].filter((v) => v > low && v < high),
      );
    const sorted = [...new Set(cuts)].sort((a, b) => a - b);
    if (sorted.length === 1) sorted.push(sorted[0]);
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i],
        b = sorted[i + 1];
      const point = (distance: number): Vec3 => {
        const d = detours.find(
          (d) =>
            distance >= d.center - d.outer && distance <= d.center + d.outer,
        );
        const lateral = d ? routeOffset(path, d.q, distance - d.center) : 0;
        return [
          s.a.x + s.dx * (distance - low) + s.dz * lateral,
          body.groundY + body.height / 2,
          s.a.z + s.dz * (distance - low) - s.dx * lateral,
        ];
      };
      const p0 = point(a),
        p1 = point(a + (b - a) / 3),
        p2 = point(a + ((b - a) * 2) / 3),
        p3 = point(b);
      const c1 = p0.map(
        (v, j) => (-5 * v + 18 * p1[j] - 9 * p2[j] + 2 * p3[j]) / 6,
      ) as Vec3;
      const c2 = p0.map(
        (v, j) => (2 * v - 9 * p1[j] + 18 * p2[j] - 5 * p3[j]) / 6,
      ) as Vec3;
      result.push(
        ...reserveCubic(
          `route-${index}-${i}`,
          [p0, c1, c2, p3],
          [body.radius, body.height / 2, body.radius],
          [
            Math.max(s.start, timeAt(a, false)),
            Math.min(s.end, timeAt(b, true)),
          ],
        ),
      );
    }
  });
  return result;
}
