import * as T from "three";
import { createCore } from "./landmark-kit";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Asset } from "./model";
import type { Recipe } from "./design";
import { physical } from "./spatial-adapter";
import { rockGeometry } from "./rock-geometry";
export class Kit {
  materials = new Map<string, T.MeshStandardMaterial>();
  geometries = new Map<string, T.BufferGeometry>();
  textures: T.Texture[] = [];
  recipes: Recipe[] = [];
  constructor(recipes: Recipe[] = []) {
    this.recipes = recipes;
  }
  mat(color: string, glow = false) {
    const key = color + glow;
    if (!this.materials.has(key))
      this.materials.set(
        key,
        new T.MeshStandardMaterial({
          color,
          roughness: 0.86,
          flatShading: true,
          emissive: glow ? color : "#000000",
          emissiveIntensity: glow ? 0.5 : 0,
        }),
      );
    return this.materials.get(key)!;
  }
  geo(shape: string) {
    if (!this.geometries.has(shape))
      this.geometries.set(
        shape,
        shape === "box"
          ? new T.BoxGeometry(1, 1, 1)
          : shape === "rock"
            ? rockGeometry()
            : shape === "taper"
              ? new T.CylinderGeometry(0.43, 1, 1, 9)
              : shape === "ball"
                ? new T.IcosahedronGeometry(1, 1)
                : shape === "cone"
                  ? new T.ConeGeometry(1, 1, 7)
                  : shape === "cylinder"
                    ? new T.CylinderGeometry(1, 1, 1, 10)
                    : shape === "torus"
                      ? new T.TorusGeometry(1, 0.1, 6, 18)
                      : shape === "robe"
                        ? new T.CylinderGeometry(0.2, 0.43, 0.85, 10)
                        : shape === "roof"
                          ? new T.ConeGeometry(1, 1, 4)
                          : new T.SphereGeometry(1, 16, 10),
      );
    return this.geometries.get(shape)!;
  }
  mesh(
    g: T.Object3D,
    shape: string,
    color: string,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    glow = false,
  ) {
    const m = new T.Mesh(this.geo(shape), this.mat(color, glow));
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  }
  box(
    g: T.Object3D,
    c: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    glow = false,
  ) {
    return this.mesh(g, "box", c, x, y, z, w, h, d, glow);
  }
  label(
    g: T.Object3D,
    text: string,
    x: number,
    y: number,
    z: number,
    w = 2.8,
    h = 0.58,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const c = canvas.getContext("2d")!;
    c.fillStyle = "#264e4c";
    c.fillRect(0, 0, 512, 128);
    c.fillStyle = "#fae1b2";
    c.font = "bold 52px sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(text, 256, 68);
    const tex = new T.CanvasTexture(canvas);
    tex.colorSpace = T.SRGBColorSpace;
    this.textures.push(tex);
    const material = new T.MeshStandardMaterial({ map: tex, roughness: 1 });
    const m = new T.Mesh(new T.PlaneGeometry(w, h), material);
    physical(m, "decoration");
    m.position.set(x, y, z);
    g.add(m);
    g.userData.extra ??= [];
    g.userData.extra.push(m);
  }
  person(color = "#dd8862", scale = 1) {
    const g = new T.Group();
    g.scale.setScalar(scale);
    this.box(g, color, 0, 1.12, 0, 0.57, 0.72, 0.34);
    this.mesh(g, "sphere", "#f0c2a0", 0, 1.79, 0, 0.31, 0.34, 0.29);
    this.mesh(g, "sphere", "#40372f", 0, 1.95, -0.035, 0.32, 0.2, 0.29);
    this.box(g, "#e8bc96", 0, 1.76, 0.29, 0.12, 0.13, 0.09);
    this.box(g, "#253e40", -0.115, 1.85, 0.267, 0.045, 0.045, 0.04);
    this.box(g, "#253e40", 0.115, 1.85, 0.267, 0.045, 0.045, 0.04);
    const legs = [-1, 1].map((side) => {
      const l = new T.Group();
      l.position.set(side * 0.16, 0.79, 0);
      this.box(l, "#304f57", 0, -0.28, 0, 0.21, 0.56, 0.23);
      this.box(l, "#f5edda", 0, -0.66, 0.06, 0.25, 0.17, 0.39);
      g.add(l);
      return l;
    });
    const arms = [-1, 1].map((side) => {
      const a = new T.Group();
      a.position.set(side * 0.38, 1.4, 0);
      this.box(a, color, 0, -0.19, 0, 0.18, 0.4, 0.23);
      this.mesh(a, "sphere", "#f0c2a0", 0, -0.45, 0, 0.1, 0.13, 0.1);
      g.add(a);
      return a;
    });
    this.box(g, "#ede0b7", 0, 1.16, -0.25, 0.42, 0.48, 0.2);
    g.userData.legs = legs;
    g.userData.arms = arms;
    g.userData.kind = "person";
    return g;
  }
  observer(color = "#ffffff", scale = 0.85) {
    const g = new T.Group();
    g.scale.setScalar(scale);
    this.mesh(g, "robe", color, 0, 0.68, 0, 1, 1, 1);
    this.mesh(g, "sphere", "#34444d", 0, 1.15, 0.06, 0.21, 0.23, 0.2);
    this.mesh(g, "cone", color, 0, 1.56, 0, 0.4, 0.72, 0.37);
    this.mesh(g, "cylinder", color, 0, 1.215, 0.04, 0.41, 0.055, 0.37);
    const legs = [-1, 1].map((side) => {
      const l = new T.Group();
      l.position.set(side * 0.12, 0.29, 0);
      this.box(l, color, 0, -0.12, 0, 0.105, 0.24, 0.105);
      this.box(l, color, 0, -0.25, 0.04, 0.13, 0.065, 0.21);
      g.add(l);
      return l;
    });
    g.userData.legs = legs;
    g.userData.kind = "observer";
    const white = this.mat(color).clone();
    white.emissive.set(color);
    white.emissiveIntensity = 0.18;
    this.materials.set("observer", white);
    g.traverse((o) => {
      if (
        o instanceof T.Mesh &&
        (o.material as T.MeshStandardMaterial).color.getHexString() !== "34444d"
      )
        o.material = white;
    });
    return g;
  }
  fromRecipe(r: Recipe) {
    const g = new T.Group(),
      roof = new T.Group();
    roof.name = "cutaway-roof";
    roof.userData.noBatch = true;
    for (const p of r.parts) {
      const m = this.mesh(
        g,
        p.shape,
        p.color,
        ...p.position,
        ...p.scale,
        p.glow,
      );
      if (p.rotation) m.rotation.set(...p.rotation);
      if (p.role) physical(m, p.role);
      if (p.viewRole === "roof") roof.add(m);
      if (p.viewRole === "focus") m.name = "component-focus";
      if (p.feature) m.userData.visualFeature = p.feature;
    }
    if (roof.children.length) g.add(roof);
    g.userData.recipe = r.id;
    if (r.effects) g.userData.visualEffects = structuredClone(r.effects);
    return g;
  }
  batch(g: T.Group) {
    if (g.userData.kind === "person" || g.userData.kind === "observer") return;
    g.updateMatrixWorld(true);
    const inverse = g.matrixWorld.clone().invert();
    const buckets = new Map<T.Material, T.Mesh[]>();
    g.traverse((o) => {
      if (o instanceof T.Mesh && !Array.isArray(o.material)) {
        const list = buckets.get(o.material) ?? [];
        list.push(o);
        buckets.set(o.material, list);
      }
    });
    for (const [material, meshes] of buckets) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((m) => {
        const part = m.geometry.index
          ? m.geometry.toNonIndexed()
          : m.geometry.clone();
        return part.applyMatrix4(
          new T.Matrix4().multiplyMatrices(inverse, m.matrixWorld),
        );
      });
      const geometry = mergeGeometries(parts);
      parts.forEach((p) => p.dispose());
      if (!geometry) continue;
      meshes.forEach((m) => m.removeFromParent());
      const merged = new T.Mesh(geometry, material);
      merged.castShadow = meshes.some((m) => m.castShadow);
      merged.receiveShadow = true;
      g.add(merged);
      g.userData.mergedGeometries ??= [];
      g.userData.mergedGeometries.push(geometry);
    }
  }
  tree(kind = "round", color = "#62977f", height = 1) {
    const g = new T.Group();
    this.mesh(g, "cylinder", "#775e4c", 0, 1.3, 0, 0.17, 2.6, 0.17);
    if (kind === "cone") {
      for (let i = 0; i < 3; i++)
        this.mesh(
          g,
          "cone",
          color,
          0,
          2.2 + i * 0.85,
          0,
          1.15 - i * 0.24,
          2,
          1.15 - i * 0.24,
        );
    } else {
      this.mesh(g, "ball", color, 0, 3.15, 0, 1.45, 1.7, 1.25);
      this.mesh(g, "ball", color, -0.85, 2.8, 0.15, 0.95, 1.13, 1);
      this.mesh(
        g,
        "ball",
        kind === "flower" ? "#eab5b0" : color,
        0.8,
        3.4,
        0.15,
        0.9,
        1.25,
        0.9,
      );
    }
    g.scale.setScalar(height);
    return g;
  }
  building(kind: "shop" | "home" | "tower", variant = 0) {
    const g = new T.Group();
    const colors = ["#e5c7ad", "#92b5ad", "#d2a6a1", "#b6c4ce"];
    const w = kind === "tower" ? 4.3 : 5,
      h = kind === "shop" ? 3.6 : kind === "home" ? 7 : 12;
    const d = 3.7;
    this.box(g, colors[variant % 4], 0, h / 2, 0, w, h, d);
    this.box(g, "#566a68", 0, h + 0.15, 0, w + 0.4, 0.3, d + 0.4);
    if (variant % 3 === 0 && kind !== "tower") {
      const roof = this.mesh(
        g,
        "roof",
        "#74867b",
        0,
        h + 0.8,
        0,
        (w + 0.7) * 0.73,
        1.4,
        (d + 0.7) * 0.73,
      );
      roof.rotation.y = Math.PI / 4;
    }
    if (kind === "home" && variant % 2 === 0)
      for (let floor = 1; floor < 3; floor++) {
        this.box(g, "#dfd3b9", 1.1, 1 + floor * 2, 2.2, 1.9, 0.16, 1.05);
        this.box(g, "#78958d", 1.1, 1.45 + floor * 2, 2.7, 1.9, 0.55, 0.08);
      }
    for (const side of [-1, 1])
      for (let floor = 0; floor < Math.floor(h / 2); floor++)
        for (const z of [-0.95, 0.95])
          this.box(
            g,
            "#719a9a",
            side * (w / 2 + 0.015),
            1.4 + floor * 2,
            z,
            0.03,
            0.85,
            0.62,
            true,
          );
    this.box(g, "#dbe0cc", 0, 0.18, 0.08, w + 0.3, 0.36, d + 0.2);
    for (let floor = 0; floor < Math.floor(h / 2); floor++)
      for (let col = -1; col <= 1; col++) {
        this.box(
          g,
          "#faf0d8",
          col * 1.35,
          1.35 + floor * 2,
          d / 2 + 0.03,
          0.93,
          1.2,
          0.12,
        );
        this.box(
          g,
          "#719a9a",
          col * 1.35,
          1.35 + floor * 2,
          d / 2 + 0.11,
          0.75,
          1,
          0.08,
          true,
        );
        this.box(
          g,
          "#edf0d7",
          col * 1.35,
          1.35 + floor * 2,
          d / 2 + 0.16,
          0.04,
          1,
          0.035,
        );
      }
    if (kind === "shop") {
      this.box(g, "#365f61", 0, 1.1, d / 2 + 0.16, 1.1, 1.9, 0.16);
      this.box(g, "#e4cda9", 0.31, 1.05, d / 2 + 0.26, 0.06, 0.12, 0.06);
      const awning = this.box(
        g,
        "#dc866c",
        0,
        2.6,
        d / 2 + 0.6,
        w + 0.25,
        0.14,
        1.3,
      );
      awning.rotation.x = 0.16;
      for (let j = 0; j < 9; j++)
        this.box(
          g,
          j % 2 ? "#f3dfbb" : "#cc7b62",
          -2.3 + j * 0.57,
          2.4,
          d / 2 + 1.2,
          0.57,
          0.32,
          0.12,
        );
      this.label(
        g,
        ["慢慢茶馆", "花间书屋", "巷口咖啡", "日常面包"][variant % 4],
        0,
        3.18,
        d / 2 + 0.08,
      );
      this.box(g, "#b57757", -2, 0.35, d / 2 + 0.75, 0.6, 0.7, 0.6);
      this.mesh(g, "ball", "#729473", -2, 0.95, d / 2 + 0.75, 0.6, 0.6, 0.6);
    } else {
      this.box(g, "#687f78", -1.3, h + 0.45, -0.5, 1.2, 0.6, 1);
      this.box(g, "#4c696c", 0, 1, d / 2 + 0.16, 0.85, 1.8, 0.1);
    }
    return g;
  }
  lamp() {
    const g = new T.Group();
    this.mesh(g, "cylinder", "#405d60", 0, 1.9, 0, 0.075, 3.8, 0.075);
    this.mesh(g, "cylinder", "#405d60", 0, 0.16, 0, 0.25, 0.32, 0.25);
    this.box(g, "#405d60", 0.32, 3.75, 0, 0.75, 0.1, 0.11);
    this.box(g, "#ffe0a0", 0.65, 3.6, 0, 0.55, 0.22, 0.4, true);
    this.box(g, "#405d60", 0.65, 3.8, 0, 0.65, 0.12, 0.5);
    const mat = new T.MeshBasicMaterial({
      color: "#ffcd87",
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const light = new T.Mesh(new T.CircleGeometry(1.2, 24), mat);
    light.rotation.x = -Math.PI / 2;
    light.position.set(0.6, 0.025, 0);
    g.add(light);
    g.userData.extra = [light];
    return g;
  }
  bus() {
    const g = new T.Group();
    this.box(g, "#477f78", 0, 1.2, 0, 2.15, 1.9, 5.7);
    this.box(g, "#e8d7b3", 0, 2.05, 0, 2.2, 0.55, 5.8);
    this.box(g, "#e8d7b3", 0, 0.75, 0, 2.23, 0.17, 5.7);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 5; i++)
        this.box(
          g,
          "#28464f",
          side * 1.09,
          1.65,
          -2.12 + i * 1.04,
          0.04,
          0.9,
          0.82,
        );
      for (const z of [-1.9, 1.9]) {
        const wheel = this.mesh(
          g,
          "cylinder",
          "#35414b",
          side * 1.06,
          0.46,
          z,
          0.47,
          0.24,
          0.47,
        );
        wheel.rotation.z = Math.PI / 2;
        const hub = this.mesh(
          g,
          "cylinder",
          "#b9bcad",
          side * 1.2,
          0.46,
          z,
          0.22,
          0.04,
          0.22,
        );
        hub.rotation.z = Math.PI / 2;
      }
    }
    this.box(g, "#28464f", 0, 1.7, 2.86, 1.8, 0.85, 0.04);
    this.box(g, "#ffe4a0", -0.78, 0.91, 2.89, 0.32, 0.2, 0.04, true);
    this.box(g, "#ffe4a0", 0.78, 0.91, 2.89, 0.32, 0.2, 0.04, true);
    this.label(g, "慢行  02", 0, 2.13, 2.92, 1.5, 0.25);
    return g;
  }
  bench() {
    const g = new T.Group();
    for (let i = 0; i < 3; i++)
      this.box(g, "#ad7857", 0, 0.62, -0.25 + i * 0.23, 2, 0.12, 0.18);
    for (let i = 0; i < 2; i++)
      this.box(g, "#ad7857", 0, 1 + i * 0.25, -0.4, 2, 0.18, 0.13);
    for (const x of [-0.7, 0.7]) {
      this.box(g, "#426369", x, 0.32, 0, 0.11, 0.64, 0.7);
      this.box(g, "#426369", x, 0.87, -0.4, 0.1, 0.9, 0.1);
    }
    return g;
  }
  stop() {
    const g = new T.Group();
    this.mesh(g, "cylinder", "#4a6868", 0, 1.1, 0, 0.06, 2.2, 0.06);
    this.box(g, "#e5d7ae", 0, 2.1, 0, 0.75, 1, 0.12);
    this.label(g, "BUS", 0, 2.3, 0.07, 0.65, 0.22);
    for (let i = 0; i < 3; i++)
      this.box(g, "#60827a", 0, 1.86 + i * 0.11, 0.075, 0.46, 0.035, 0.02);
    return g;
  }
  create(type: Asset | string, variant = 0): T.Group {
    const core = createCore(this, type);
    if (core) return core;
    switch (type) {
      case "tree":
        return this.tree(
          variant % 2 ? "cone" : "round",
          variant % 2 ? "#587d70" : "#739681",
          0.9 + (variant % 3) * 0.13,
        );
      case "flowerTree":
        return this.tree("flower", "#cf909c", 1.1);
      case "shop":
      case "home":
      case "tower":
        return this.building(type, variant);
      case "lamp":
        return this.lamp();
      case "bus":
        return this.bus();
      case "person":
        return this.person(
          ["#d78e64", "#799ca1", "#d6b978"][variant % 3],
          0.87,
        );
      case "bench":
        return this.bench();
      case "stop":
        return this.stop();
      default: {
        const r = this.recipes.find((r) => r.id === type);
        if (!r) throw Error("未注册构件 " + type);
        return this.fromRecipe(r);
      }
    }
  }
  dispose() {
    this.materials.forEach((m) => m.dispose());
    this.geometries.forEach((g) => g.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
export function walk(g: T.Group, t: number, strength = 1) {
  g.userData.legs?.forEach(
    (l: T.Group, i: number) =>
      (l.rotation.x = Math.sin(t * 7 + i * Math.PI) * 0.5 * strength),
  );
  g.userData.arms?.forEach(
    (l: T.Group, i: number) =>
      (l.rotation.x = -Math.sin(t * 7 + i * Math.PI) * 0.45 * strength),
  );
}
