import * as T from "three";
import { rng } from "./model";
import { physical } from "./spatial-adapter";

/** Irregular shallow shore, with an actual flat top and rock skirt. Its full
 * measured geometry participates in route safety; it is not a collision exemption. */
export function shoreSupport(width: number, depth: number, seed: number) {
  const random = rng(seed),
    n = 18,
    top: T.Vector3[] = [],
    bottom: T.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const r = 0.93 + random() * 0.13;
    top.push(
      new T.Vector3(
        Math.cos(angle) * width * r,
        -0.02,
        Math.sin(angle) * depth * r,
      ),
    );
    bottom.push(
      new T.Vector3(top[i].x * 1.03, -1.1 - random() * 0.6, top[i].z * 1.03),
    );
  }
  const vertices: number[] = [],
    colors: number[] = [];
  const triangle = (
    a: T.Vector3,
    b: T.Vector3,
    c: T.Vector3,
    color: string,
    shade: number,
  ) => {
    vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
    const paint = new T.Color(color).multiplyScalar(shade);
    for (let j = 0; j < 3; j++) colors.push(paint.r, paint.g, paint.b);
  };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    triangle(
      new T.Vector3(0, -0.02, 0),
      top[j],
      top[i],
      "#8f9b88",
      0.94 + random() * 0.08,
    );
    triangle(top[i], top[j], bottom[i], "#7e8990", 0.8 + random() * 0.22);
    triangle(bottom[i], top[j], bottom[j], "#7e8990", 0.72 + random() * 0.18);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const mesh = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      flatShading: true,
    }),
  );
  mesh.receiveShadow = true;
  const group = physical(new T.Group(), "support");
  group.add(mesh);
  group.userData.extra = [mesh];
  return group;
}
