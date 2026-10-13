import { positionAt, type Segment } from "./path";
import { observerSpace } from "./domain/observer-space";
export type PlayerView = "overhead" | "first" | "auto";
export interface CameraTrack {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
}
export interface CameraPair {
  overhead: CameraTrack;
  first: CameraTrack;
}
export function cameraPair(
  path: Segment[],
  time: number,
  scale: number,
): CameraPair {
  const p = positionAt(path, time),
    a = positionAt(path, Math.max(0, time - 0.7)),
    b = positionAt(path, Math.min(path.at(-1)!.end, time + 1.6));
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  const fx = length > 0.001 ? (b.x - a.x) / length : p.segment.dx,
    fz = length > 0.001 ? (b.z - a.z) / length : p.segment.dz;
  const eye = observerSpace(scale).eyeY;
  return {
    overhead: {
      position: [p.x - fx * 17 + fz * 12, 25, p.z - fz * 17 - fx * 12],
      target: [p.x + fx * 4, 1, p.z + fz * 4],
      fov: 48,
    },
    first: {
      position: [p.x, eye, p.z],
      target: [p.x + fx * 18, eye + 0.15, p.z + fz * 18],
      fov: 68,
    },
  };
}
