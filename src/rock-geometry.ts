import { IcosahedronGeometry } from "three";

/** Shared, deterministic angular rock. Coordinates stay inside the unit sphere;
 * Kit owns/disposes this geometry like every other primitive. */
export function rockGeometry() {
  const geometry = new IcosahedronGeometry(1, 1);
  const vertices = geometry.getAttribute("position");
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i),
      y = vertices.getY(i),
      z = vertices.getZ(i);
    // Coordinate noise preserves identical vertices across unindexed triangles.
    const wave = Math.sin(x * 9.3 + y * 4.7 + z * 7.1) * 0.5 + 0.5;
    const radius = 0.79 + 0.2 * wave;
    vertices.setXYZ(i, x * radius, y * radius, z * radius);
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
