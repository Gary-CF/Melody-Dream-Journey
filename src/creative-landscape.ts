import * as T from "three";
import type { Kit } from "./assets";
import type { SceneRecipe } from "./domain/creative-library";
import type { Segment } from "./path";
import { basePositionAt } from "./path";
import { rng } from "./model";
import type { PlacementSession } from "./placement";
import { releaseCandidate } from "./spatial-adapter";
import { shoreSupport } from "./shore-support";

/** Bounded background terrain. The safe route remains authoritative, including
 * bends elsewhere in the song. These are solid landforms, not collision exemptions. */
export function terrainPatch(
  seed: number,
  radius: number,
  height: number,
  palette = { low: "#496a65", high: "#a5b3a2" },
) {
  const random = rng(seed),
    ringCount = 7,
    steps = 28;
  const positions: number[] = [],
    indices: number[] = [];
  const peaks = Array.from({ length: 5 }, () => ({
    x: (random() - 0.5) * 1.1,
    z: (random() - 0.5) * 0.75,
    height: 0.4 + random() * 0.6,
    width: 0.18 + random() * 0.2,
  }));
  const sample = (x: number, z: number) => {
    let y = 0;
    for (const peak of peaks) {
      const distance = Math.hypot(x - peak.x, z - peak.z) / peak.width;
      y = Math.max(y, peak.height * Math.exp(-distance * distance * 0.6));
    }
    return y * height * Math.max(0, 1 - Math.pow(Math.hypot(x, z), 5));
  };
  positions.push(0, sample(0, 0), 0);
  for (let ring = 1; ring <= ringCount; ring++) {
    for (let step = 0; step < steps; step++) {
      const angle = (step / steps) * Math.PI * 2;
      const distance = ring / ringCount;
      const x = Math.cos(angle) * distance,
        z = Math.sin(angle) * distance;
      positions.push(x * radius, sample(x, z) - 0.05, z * radius * 0.8);
      const current = 1 + (ring - 1) * steps + step;
      const next = 1 + (ring - 1) * steps + ((step + 1) % steps);
      if (ring === 1) indices.push(0, next, current);
      else {
        const inner = current - steps,
          innerNext = next - steps;
        indices.push(inner, next, current, inner, innerNext, next);
      }
    }
  }
  const indexed = new T.BufferGeometry();
  indexed.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  indexed.setIndex(indices);
  const geometry = indexed.toNonIndexed();
  indexed.dispose();
  geometry.computeVertexNormals();
  const colors: number[] = [],
    p = geometry.getAttribute("position");
  const low = new T.Color(palette.low),
    high = new T.Color(palette.high);
  for (let i = 0; i < p.count; i += 3) {
    const elevation =
      (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / (height * 3);
    const color = low.clone().lerp(high, Math.min(1, elevation * 1.3));
    color.multiplyScalar(0.94 + random() * 0.12);
    for (let j = 0; j < 3; j++) colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new T.Float32BufferAttribute(colors, 3));
  const material = new T.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1,
  });
  const mesh = new T.Mesh(geometry, material),
    group = new T.Group();
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.userData.extra = [mesh];
  return group;
}

export function buildCreativeLandscape(
  kit: Kit,
  recipe: SceneRecipe,
  path: Segment[],
  placement: PlacementSession,
  root: T.Group,
  seed: number,
) {
  const accepted: T.Group[] = [],
    random = rng(seed + 731),
    end = path.at(-1)?.end ?? 0;
  const wooded = recipe.components.some(
    (id) => id === "tree" || id === "flowerTree",
  );
  const wilderness = !recipe.components.some((id) =>
    ["shop", "home", "tower", "bus"].includes(id),
  );
  const count = Math.min(24, Math.max(4, Math.ceil(end / 12)));
  const accept = (group: T.Group, id: string) => {
    const result = placement.place(id, group);
    if (result.status === "rejected") {
      releaseCandidate(group);
      return;
    }
    root.add(group);
    accepted.push(group);
  };
  if (recipe.terrain === "waterfront") {
    const banks = Math.min(14, count);
    for (let i = 0; i < banks; i++) {
      const pos = basePositionAt(path, ((i + 0.5) / banks) * end);
      const side = i % 2 ? 1 : -1,
        offset = 58 + random() * 18;
      const bank = new T.Group();
      bank.position.set(
        pos.x + pos.segment.dz * side * offset,
        0,
        pos.z - pos.segment.dx * side * offset,
      );
      bank.add(
        shoreSupport(24 + random() * 12, 27 + random() * 14, seed + i * 113),
      );
      if (wooded)
        for (let j = 0; j < 4; j++) {
          const tree = kit.tree(
            "round",
            ["#638576", "#729385", "#819c88"][j % 3],
            1.4 + random() * 0.7,
          );
          tree.position.set((random() - 0.5) * 25, 0, (random() - 0.5) * 30);
          bank.add(tree);
        }
      bank.userData.range = 260;
      accept(bank, `landscape/shore/${i}`);
    }
  }
  if (recipe.terrain === "highland") {
    for (let i = 0; i < count; i++) {
      const pos = basePositionAt(path, ((i + 0.5) / count) * end);
      for (const side of [-1, 1]) {
        const radius = 42 + random() * 24,
          offset = radius + 45 + random() * 25;
        const patch = terrainPatch(
          seed + i * 53 + side,
          radius,
          38 + random() * 42,
        );
        patch.position.set(
          pos.x + pos.segment.dz * side * offset,
          -0.15,
          pos.z - pos.segment.dx * side * offset,
        );
        patch.rotation.y = random() * Math.PI;
        patch.userData.range = 290;
        accept(patch, `landscape/highland/${i}/${side}`);
      }
    }
  }
  if (wooded && wilderness && recipe.terrain !== "waterfront") {
    const clusterCount = Math.min(48, count * 2);
    for (let i = 0; i < clusterCount; i++) {
      const pos = basePositionAt(path, ((i + 0.5) / clusterCount) * end);
      const side = i % 2 ? -1 : 1,
        distance = 19 + random() * 24;
      const cluster = new T.Group();
      cluster.position.set(
        pos.x + pos.segment.dz * side * distance,
        0,
        pos.z - pos.segment.dx * side * distance,
      );
      const trees = recipe.terrain === "highland" ? 3 : 7;
      for (let j = 0; j < trees; j++) {
        const tree = kit.tree(
          random() > 0.45 ? "cone" : "round",
          ["#46776d", "#5f8a77", "#79947b"][j % 3],
          1.5 + random() * 1.3,
        );
        tree.position.set((random() - 0.5) * 12, 0, (random() - 0.5) * 12);
        cluster.add(tree);
      }
      cluster.userData.range = 190;
      accept(cluster, `landscape/woodland/${i}`);
    }
  }
  return accepted;
}
