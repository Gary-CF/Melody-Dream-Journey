import * as T from "three";
import { declareAssemblyParts } from "./scene-assembly";
import { physical } from "./spatial-adapter";
import type { Kit } from "./assets";
import { coreAssets } from "./core-catalog";
import { terrainPatch } from "./creative-landscape";
export { coreAssets } from "./core-catalog";
function beam(
  k: Kit,
  g: T.Group,
  a: T.Vector3,
  b: T.Vector3,
  r: number,
  color: string,
) {
  const m = k.mesh(g, "cylinder", color, 0, 0, 0, r, a.distanceTo(b), r);
  m.position.copy(a).lerp(b, 0.5);
  m.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
}
function tree(k: Kit, g: T.Group, kind: string) {
  const color =
    kind === "osmanthus"
      ? "#e6b84f"
      : kind === "sakura"
        ? "#eaa7bc"
        : kind === "willow"
          ? "#719c87"
          : "#426e66";
  beam(k, g, new T.Vector3(0, 0, 0), new T.Vector3(0.5, 8, 0), 0.7, "#665062");
  if (kind === "osmanthus") {
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4,
        y = 4.5 + (i % 4) * 1.1,
        x = Math.cos(a) * (2.2 + (i % 3) * 0.6),
        z = Math.sin(a) * (2.2 + (i % 3) * 0.6);
      beam(
        k,
        g,
        new T.Vector3(0.3, y * 0.45, 0),
        new T.Vector3(x, y, z),
        0.2,
        "#79664a",
      );
      k.mesh(g, "ball", "#a0a460", x, y, z, 2.1, 2.2, 2.1);
      for (let j = 0; j < 5; j++)
        k.mesh(
          g,
          "ball",
          j % 2 ? "#e9bc60" : "#f5d981",
          x + Math.sin(j * 2.4) * 1.8,
          y + Math.cos(j) * 1.4,
          z + Math.cos(j * 2.4) * 1.6,
          0.55,
          0.5,
          0.55,
        );
    }
    return;
  }
  for (let i = 0; i < 9; i++) {
    const angle = i * 2.4,
      y = 4 + i * 0.43,
      x = Math.cos(angle) * (3 + i * 0.2),
      z = Math.sin(angle) * (3 + i * 0.2);
    beam(
      k,
      g,
      new T.Vector3(0.2, y * 0.6, 0),
      new T.Vector3(x, y + 2, z),
      0.24,
      "#665062",
    );
    for (let j = 0; j < 5; j++) {
      const a = j * 2.399 + i;
      const m = k.mesh(
        g,
        kind === "pine" ? "cone" : "ball",
        j % 3 ? color : kind === "sakura" ? "#ffd0d2" : "#d0b967",
        x + Math.cos(a) * 1.6,
        y + 2 + (j % 3) * 0.4,
        z + Math.sin(a) * 1.6,
        2.5,
        kind === "willow" ? 2.3 : 1.35,
        2.2,
      );
      m.rotation.y = a;
    }
    if (kind === "willow")
      for (let j = 0; j < 5; j++)
        k.box(g, color, x + (j - 2) * 0.6, y, z, 0.09, 5, 0.12);
  }
}
function pavilion(k: Kit, g: T.Group) {
  physical(k.box(g, "#aab4ad", 0, 0.15, 0, 9, 0.5, 8), "support");
  for (const x of [-3.3, 3.3])
    for (const z of [-2.8, 2.8]) {
      k.box(g, "#733d55", x, 3, z, 0.38, 6, 0.38);
      k.box(g, "#e6b781", x, 5.6, z, 0.8, 0.2, 0.8);
    }
  for (const y of [5.5, 7.5]) {
    const roof = k.mesh(g, "roof", "#386577", 0, y, 0, 6, 2.8, 5.7);
    roof.rotation.y = Math.PI / 4;
    k.box(g, "#623c57", 0, y - 1, 0, 9.3, 0.25, 8.8);
    for (const x of [-4.4, 4.4])
      for (const z of [-4.1, 4.1])
        beam(
          k,
          g,
          new T.Vector3(x * 0.6, y - 0.5, z * 0.6),
          new T.Vector3(x, y + 0.2, z),
          0.14,
          "#71445b",
        );
  }
  k.mesh(g, "ball", "#e1aa67", 0, 9.1, 0, 0.24, 0.6, 0.24, true);
  for (const x of [-3.3, 3.3])
    k.mesh(g, "cylinder", "#ffcc8d", x, 4.6, 0, 0.35, 0.8, 0.35, true);
}
function bridge(k: Kit, g: T.Group, stone: boolean) {
  if (stone) {
    for (let z = -7; z < 7; z += 0.7) {
      const y = 1.8 * (1 - (z * z) / 49);
      const m = physical(
        k.box(g, "#b2babb", 0, y, z, 5, 0.42, 0.78),
        "support",
      );
      m.rotation.x = Math.atan((-3.6 * z) / 49);
      for (const x of [-2.3, 2.3]) {
        k.box(g, "#9ba6ab", x, y + 0.6, z, 0.28, 1.1, 0.28);
        k.mesh(g, "ball", "#c4cbc4", x, y + 1.2, z, 0.23, 0.18, 0.23);
        if (Math.abs(z) < 5.8)
          beam(
            k,
            g,
            new T.Vector3(x, y - 0.35, z),
            new T.Vector3(x, y - 0.35, z + 0.7),
            0.3,
            "#7b8d96",
          );
      }
    }
    return;
  }
  const c = stone ? "#bdc1bb" : "#bd5f72";
  physical(k.box(g, c, 0, 0, 0, 5, 0.4, 14), "support");
  for (let z = -6.5; z < 7; z += 0.65)
    physical(
      k.box(g, stone ? "#89989c" : "#954760", 0, 0.22, z, 5, 0.03, 0.07),
      "support",
    );
  for (const x of [-2.4, 2.4]) {
    k.box(g, c, x, 1, 0, 0.16, 0.16, 14);
    for (let z = -6; z <= 6; z += 2) k.box(g, c, x, 0.6, z, 0.22, 1.25, 0.22);
  }
  for (const z of [-5, 5])
    for (const x of [-2, 2]) k.box(g, "#696579", x, -1.3, z, 0.4, 2.5, 0.4);
}
function stool(k: Kit, g: T.Group) {
  k.mesh(g, "cylinder", "#946d51", 0, 0.9, 0, 0.55, 0.18, 0.55);
  for (const x of [-0.32, 0.32])
    for (const z of [-0.32, 0.32])
      k.box(g, "#624739", x, 0.45, z, 0.12, 0.9, 0.12);
}
export function createCore(k: Kit, id: string): T.Group | undefined {
  if (!coreAssets.some((a) => a.id === id)) return;
  const g = new T.Group();
  g.userData.coreId = id;
  const n = id.slice(5);
  if (["sakura", "osmanthus", "willow", "pine"].includes(n)) tree(k, g, n);
  else if (n === "pavilion") pavilion(k, g);
  else if (n === "ridge") {
    const landform = terrainPatch(7391, 40, 48, {
      low: "#526677",
      high: "#a2aebe",
    });
    g.add(landform);
  } else if (n === "stoneArch") {
    // Each rock remains a separate collider; the opening is genuinely empty.
    for (let i = 0; i < 9; i++) {
      const angle = (i / 8) * Math.PI;
      const rock = k.mesh(
        g,
        "ball",
        ["#8b8e98", "#747f8d", "#a5a6ab"][i % 3],
        Math.cos(angle) * 3.8,
        1.6 + Math.sin(angle) * 4.4,
        Math.sin(i * 2.1) * 0.17,
        1.05 + (i % 3) * 0.12,
        1.3 + (i % 2) * 0.3,
        0.85 + (i % 3) * 0.12,
      );
      rock.rotation.z = angle - Math.PI / 2;
      rock.rotation.y = Math.sin(i) * 0.25;
    }
    for (const side of [-1, 1]) {
      k.mesh(g, "ball", "#737d89", side * 3.7, 0.8, 0, 1.25, 1.25, 1.1);
      k.mesh(g, "ball", "#92939b", side * 4.45, 0.32, 0.7, 1.35, 0.4, 1.25);
    }
  } else if (n === "redBridge" || n === "stoneBridge")
    bridge(k, g, n === "stoneBridge");
  else if (n === "moonGate") {
    k.mesh(g, "torus", "#c6b7ba", 0, 3, 0, 2.6, 2.6, 0.8);
    for (const x of [-3.8, 3.8]) k.box(g, "#c6b7ba", x, 2.8, 0, 2.5, 5.6, 0.65);
    k.box(g, "#496975", 0, 5.8, 0, 10, 0.3, 1);
  } else if (n === "stoneLantern") {
    k.mesh(g, "cylinder", "#8a8a9a", 0, 1.2, 0, 0.45, 2.4, 0.45);
    k.box(g, "#777a8f", 0, 2.6, 0, 1.6, 0.25, 1.6);
    k.box(g, "#ffd295", 0, 3, 0, 0.7, 0.8, 0.7, true);
    k.mesh(g, "roof", "#62727d", 0, 3.8, 0, 1.2, 0.9, 1.2);
  } else if (n === "pendant") {
    k.box(g, "#554c50", 0, 2.9, 0, 0.035, 2, 0.035);
    k.mesh(g, "cone", "#586d72", 0, 1.8, 0, 1, 0.8, 1);
    k.mesh(g, "sphere", "#ffd99a", 0, 1.45, 0, 0.32, 0.24, 0.32, true);
    k.mesh(g, "cylinder", "#a18b65", 0, 1.42, 0, 1, 0.06, 1);
  } else if (n === "paperLantern") {
    k.box(g, "#655563", 0, 2.8, 0, 0.04, 1.6, 0.04);
    k.mesh(g, "sphere", "#ffd197", 0, 1.7, 0, 0.6, 0.85, 0.6, true);
    for (const y of [1, 2.4])
      k.mesh(g, "cylinder", "#804755", 0, y, 0, 0.35, 0.12, 0.35);
  } else if (n === "rocks") {
    for (let i = 0; i < 7; i++) {
      const m = k.mesh(
        g,
        "ball",
        i % 2 ? "#86879b" : "#a1a2b4",
        Math.sin(i * 2.4) * 2,
        i * 0.23,
        Math.cos(i * 2.4) * 2,
        1.7,
        1 + i * 0.1,
        1.2,
      );
      m.rotation.z = i;
    }
  } else if (n === "mountain") {
    for (let i = 0; i < 7; i++) {
      const m = k.mesh(
        g,
        "cone",
        i % 2 ? "#8195ad" : "#5e7894",
        (i - 3) * 10,
        10 + (i % 3) * 3,
        Math.sin(i) * 8,
        16,
        25 + (i % 3) * 9,
        13,
      );
      m.rotation.y = i * 0.6;
    }
    declareAssemblyParts(
      g,
      g.children.map((root, i) => ({
        id: `landform-${i}`,
        root,
        minimumGap: 0,
        interlocking: true,
      })),
    );
  } else if (n === "reeds") {
    for (let i = 0; i < 19; i++) {
      const x = Math.sin(i * 2.4) * 1.3,
        z = Math.cos(i * 2.4) * 1.3;
      beam(
        k,
        g,
        new T.Vector3(x, 0, z),
        new T.Vector3(x + 0.3, 1.8 + (i % 3) * 0.3, z),
        0.035,
        "#8b9672",
      );
      k.mesh(
        g,
        "cone",
        "#d4c799",
        x + 0.3,
        2.1 + (i % 3) * 0.3,
        z,
        0.12,
        0.7,
        0.12,
      );
    }
  } else if (n === "lotus") {
    for (let i = 0; i < 6; i++) {
      k.mesh(
        g,
        "cylinder",
        "#5c9686",
        Math.cos(i) * 1.4,
        0,
        Math.sin(i) * 1.4,
        0.7,
        0.05,
        0.7,
      );
    }
    for (let i = 0; i < 7; i++)
      k.mesh(
        g,
        "ball",
        "#efa5be",
        Math.cos(i) * 0.25,
        0.22,
        Math.sin(i) * 0.25,
        0.22,
        0.25,
        0.4,
      );
  } else if (n === "bar") {
    k.box(g, "#6f4a40", 0, 0.8, 0, 4, 1.6, 1.2);
    k.box(g, "#c09467", 0, 1.7, 0, 4.3, 0.2, 1.5);
    for (const x of [-1, 0, 1])
      k.mesh(g, "cylinder", "#9dc5bd", x, 1.95, 0, 0.1, 0.3, 0.1);
  } else if (n === "table") {
    k.mesh(g, "cylinder", "#ab805a", 0, 1.15, 0, 1.35, 0.18, 1.35);
    k.mesh(g, "cylinder", "#6e4c40", 0, 0.55, 0, 0.14, 1.1, 0.14);
    for (const x of [-0.5, 0.5])
      k.mesh(g, "cylinder", "#f0dbb3", x, 1.35, 0, 0.12, 0.22, 0.12);
    k.mesh(g, "sphere", "#d7b784", 0, 1.4, 0, 0.24, 0.2, 0.24);
  } else if (n === "stool") stool(k, g);
  else if (n === "shelves") {
    for (const x of [-1.8, 1.8]) k.box(g, "#65463d", x, 1.7, 0, 0.16, 3.4, 0.5);
    for (const y of [0.4, 1.4, 2.4, 3.4]) {
      k.box(g, "#976c4f", 0, y, 0, 3.8, 0.13, 0.6);
      if (y < 3)
        for (let i = 0; i < 6; i++) {
          k.mesh(
            g,
            "cylinder",
            i % 2 ? "#72998e" : "#b77e56",
            (i - 2.5) * 0.5,
            y + 0.3,
            0,
            0.12,
            0.5,
            0.12,
          );
          k.mesh(
            g,
            "cylinder",
            "#b9ae7c",
            (i - 2.5) * 0.5,
            y + 0.6,
            0,
            0.05,
            0.16,
            0.05,
          );
        }
    }
  } else if (n === "lattice") {
    k.box(g, "#ffc993", 0, 2, 0, 3, 2.4, 0.06, true);
    for (let x = -1.5; x <= 1.5; x += 0.5)
      k.box(g, "#67443e", x, 2, 0.06, 0.07, 2.6, 0.1);
    for (let y = 0.7; y < 3.4; y += 0.5)
      k.box(g, "#67443e", 0, y, 0.06, 3.1, 0.07, 0.1);
  } else if (n === "neon") {
    for (const x of [-1.8, 1.8]) k.box(g, "#4b415e", x, 3, 0, 0.14, 6, 0.14);
    k.box(g, "#3b3b60", 0, 4.2, 0, 4.2, 2.1, 0.3);
    for (const y of [3.25, 5.15])
      k.box(g, "#ff7bb3", 0, y, -0.18, 4, 0.08, 0.07, true);
    for (const x of [-1.95, 1.95])
      k.box(g, "#80e6df", x, 4.2, -0.18, 0.08, 2, 0.07, true);
    k.label(g, "夜 色", 0, 4.2, 0.21, 3, 0.8);
    k.label(g, "夜 色", 0, 4.2, -0.21, 3, 0.8);
    g.userData.extra.at(-1).rotation.y = Math.PI;
    for (const y of [3.25, 5.15])
      k.box(g, "#ff7bb3", 0, y, 0.18, 4, 0.08, 0.07, true);
    for (const x of [-1.95, 1.95])
      k.box(g, "#80e6df", x, 4.2, 0.18, 0.08, 2, 0.07, true);
  } else if (n === "truss") {
    for (const x of [-4, 4]) k.box(g, "#566073", x, 4, 0, 0.4, 8, 0.4);
    k.box(g, "#667286", 0, 8, 0, 8.5, 0.4, 0.4);
    for (let i = 0; i < 4; i++)
      beam(
        k,
        g,
        new T.Vector3(-4 + i * 2, 7.8, 0),
        new T.Vector3(-2 + i * 2, 6.5, 0),
        0.09,
        "#a893ae",
      );
  } else if (n === "beacon") {
    k.box(g, "#484b78", 0, 10, 0, 3, 20, 3);
    for (let y = 2; y < 20; y += 1.7)
      for (const x of [-1.55, 1.55])
        k.box(g, "#88cfe1", x, y, 0, 0.06, 0.12, 3.1, true);
    k.mesh(g, "cone", "#e09abe", 0, 22, 0, 1.4, 4, 1.4, true);
  } else if (n === "tavern") {
    physical(k.box(g, "#a88160", 0, 0.1, 0, 10, 0.25, 12), "support");
    // The forward passage stays open; both cameras share the same interior.
    for (const x of [-5, 5]) {
      const wall = k.box(g, "#84746b", x, 2.7, 0, 0.3, 5.4, 12);
      if (x < 0) wall.name = "cutaway-wall";
      for (const z of [-3, 3]) {
        const w = createCore(k, "core-lattice")!;
        w.position.set(x * 0.95, 0, z);
        w.rotation.y = Math.PI / 2;
        g.add(w);
      }
    }
    for (const z of [-6, 6])
      for (const x of [-3.7, 3.7]) {
        const wall = k.box(g, "#a0907c", x, 2.7, z, 2.6, 5.4, 0.25);
        if (z < 0) wall.name = "cutaway-wall";
      }
    for (const z of [-6, 6]) k.box(g, "#695049", 0, 5.15, z, 10, 0.5, 0.35);
    for (let z = -5.8; z < 6; z += 0.6)
      physical(k.box(g, "#80664e", 0, 0.235, z, 9.7, 0.012, 0.025), "support");
    for (const x of [-4.6, 4.6])
      for (const z of [-5.5, 0, 5.5])
        k.box(g, "#60493f", x, 2.7, z, 0.17, 5.4, 0.17);
    physical(k.box(g, "#577f79", 0, 0.24, 0, 2.1, 0.016, 4.5), "support");
    for (const x of [-0.95, 0.95])
      physical(k.box(g, "#d8be8d", x, 0.251, 0, 0.04, 0.01, 4.3), "support");
    const roof = new T.Group();
    roof.name = "cutaway-roof";
    k.box(roof, "#485b64", 0, 5.7, 0, 10.8, 0.8, 12.6);
    g.add(roof);
    const bar = createCore(k, "core-bar")!;
    bar.position.set(-3, 0, 1);
    bar.rotation.y = Math.PI / 2;
    g.add(bar);
    const shelf = createCore(k, "core-shelves")!;
    shelf.position.set(-4.7, 0, 1);
    shelf.rotation.y = Math.PI / 2;
    g.add(shelf);
    for (const z of [-3, 3]) {
      const table = createCore(k, "core-table")!;
      table.position.set(3, 0, z);
      g.add(table);
      for (const dz of [-1.5, 1.5]) {
        const chair = createCore(k, "core-stool")!;
        chair.position.set(3, 0, z + dz);
        g.add(chair);
      }
    }
    for (const z of [-3, 3]) {
      const light = createCore(k, "core-pendant")!;
      light.position.set(0, 2.4, z);
      g.add(light);
    }
  }
  return g;
}
