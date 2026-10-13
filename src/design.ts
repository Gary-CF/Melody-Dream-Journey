// Declarative, versioned assets: imported recipes never contain executable code.
import {
  validateVisualEffects,
  type VisualEffect,
} from "./domain/visual-effects";
export type Placement = "curb" | "water" | "backdrop" | "landmark";
export interface Part {
  /** Factory-authored visible region, distinct from the enclosing asset identity. */
  feature?: string;
  role?: "solid" | "support";
  viewRole?: "roof" | "focus";
  shape:
    | "box"
    | "ball"
    | "rock"
    | "taper"
    | "cone"
    | "cylinder"
    | "sphere"
    | "torus";
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  color: string;
  glow?: boolean;
}
export interface Recipe {
  effects?: VisualEffect[];
  id: string;
  version: number;
  name: string;
  tags: string[];
  placement: Placement;
  footprint: number;
  origin: "builtin" | "generated" | "imported";
  parts: Part[];
}
export interface Atmosphere {
  id: string;
  name: string;
  sky: string;
  water: string;
  ground: string;
  light: string;
  accent: string;
  night: number;
  sun: number;
  fog: number;
  sparkle: number;
  exposure: number;
  sunElevation?: number;
  sunAzimuth?: number;
}
export interface Direction {
  style: "auto" | "acoustic" | "electric" | "ethereal";
  keywords: string;
  allowGrowth: boolean;
}
export interface SectionEvidence {
  start: number;
  end: number;
  energy: number;
  activity: number;
  contrast: number;
  tags: string[];
  evidence: string[];
}
export interface Need {
  tag: string;
  status: "reused" | "generated" | "missing";
  asset: string;
  reason: string;
}
export interface DesignAnalysis {
  method: "preview" | "local-rules" | "temporal-analysis";
  sections: SectionEvidence[];
  needs: Need[];
  warnings: string[];
}
export const atmospheres: Atmosphere[] = [
  {
    id: "day",
    name: "清透白昼",
    sky: "#cbd9cf",
    water: "#639f9e",
    ground: "#95ad8f",
    light: "#ffe6c6",
    accent: "#db976e",
    night: 0,
    sun: 2.6,
    fog: 180,
    sparkle: 0.16,
    exposure: 1.2,
  },
  {
    id: "dusk",
    name: "橘粉黄昏",
    sky: "#d9a5a3",
    water: "#7b879b",
    ground: "#9a977d",
    light: "#ffb773",
    accent: "#e6ac78",
    night: 0.28,
    sun: 2.1,
    fog: 165,
    sparkle: 0.32,
    exposure: 1.12,
  },
  {
    id: "night",
    name: "华灯初上",
    sky: "#283a57",
    water: "#203e5c",
    ground: "#536760",
    light: "#ffcb84",
    accent: "#efad69",
    night: 1,
    sun: 0.55,
    fog: 145,
    sparkle: 0.65,
    exposure: 1.03,
  },
  {
    id: "moon",
    name: "澄澈月夜",
    sky: "#46577d",
    water: "#345476",
    ground: "#728780",
    light: "#ffe2bb",
    accent: "#e8bccc",
    night: 1,
    sun: 0.75,
    fog: 180,
    sparkle: 0.85,
    exposure: 1.08,
  },
  {
    id: "dawn",
    name: "山岚破晓",
    sky: "#d8b6ad",
    water: "#909eac",
    ground: "#91a397",
    light: "#ffc58c",
    accent: "#f2c398",
    night: 0.15,
    sun: 2.3,
    fog: 210,
    sparkle: 0.35,
    exposure: 1.2,
  },
  {
    id: "neon",
    name: "霓虹暮色",
    sky: "#26273f",
    water: "#29344d",
    ground: "#424b59",
    light: "#f9b4d0",
    accent: "#5adcdc",
    night: 1,
    sun: 0.45,
    fog: 155,
    sparkle: 0.7,
    exposure: 1.05,
  },
];
export const momentNames = {
  none: "平稳跟随",
  reveal: "视野展开",
  quiet: "月光留白",
  rise: "远景升起",
};
const part = (
  shape: Part["shape"],
  color: string,
  position: Part["position"],
  scale: Part["scale"],
  glow = false,
  rotation?: Part["rotation"],
): Part => ({
  shape,
  color,
  position,
  scale,
  glow,
  ...(rotation ? { rotation } : {}),
});
function recipe(
  id: string,
  name: string,
  tags: string[],
  placement: Placement,
  footprint: number,
  parts: Part[],
): Recipe {
  return {
    id,
    version: 1,
    name,
    tags,
    placement,
    footprint,
    parts,
    origin: "builtin",
  };
}
export function builtInRecipes(): Recipe[] {
  return [
    recipe("cafe-set", "街边桌椅", ["daily", "cafe"], "curb", 1.7, [
      part("cylinder", "#b4825f", [0, 0.8, 0], [0.72, 0.12, 0.72]),
      part("cylinder", "#466165", [0, 0.4, 0], [0.07, 0.8, 0.07]),
      ...[-1, 1].flatMap((s) => [
        part("box", "#9e785e", [s * 1.1, 0.4, 0], [0.5, 0.12, 0.5]),
        part("box", "#426368", [s * 1.1, 0.2, 0], [0.1, 0.4, 0.4]),
        part("box", "#9e785e", [s * 1.35, 0.7, 0], [0.1, 0.6, 0.5]),
      ]),
    ]),
    recipe("bicycle", "停靠自行车", ["daily", "transport"], "curb", 1.5, [
      ...[-1, 1].map((s) =>
        part("torus", "#345355", [s * 0.65, 0.42, 0], [0.42, 0.42, 0.42]),
      ),
      part(
        "box",
        "#d39065",
        [0, 0.55, 0],
        [1.3, 0.08, 0.08],
        false,
        [0, 0, 0.3],
      ),
      part("box", "#d39065", [-0.1, 0.7, 0], [0.08, 0.6, 0.08]),
      part("box", "#304a4a", [-0.1, 1.02, 0], [0.32, 0.09, 0.16]),
      part(
        "box",
        "#d39065",
        [0.6, 0.8, 0],
        [0.08, 0.8, 0.08],
        false,
        [0, 0, 0.2],
      ),
      part("box", "#304a4a", [0.57, 1.22, 0], [0.1, 0.07, 0.4]),
    ]),
    recipe("shelter", "候车雨棚", ["daily", "transport"], "curb", 2.3, [
      part("box", "#466b67", [0, 2.6, 0], [4.2, 0.2, 1.9]),
      ...[-1, 1].map((s) =>
        part("box", "#63867b", [s * 1.8, 1.3, -0.5], [0.12, 2.6, 0.12]),
      ),
      part("box", "#c6c9b5", [0, 1.5, -0.6], [3.5, 1.6, 0.1]),
      part("box", "#a98960", [0, 0.55, 0], [3, 0.18, 0.5]),
      part("box", "#f2d09a", [0, 2.4, 0.4], [3.4, 0.07, 0.12], true),
    ]),
    recipe("planter", "花箱与绿植", ["daily", "garden"], "curb", 1.4, [
      part("box", "#b28469", [0, 0.35, 0], [2.2, 0.7, 0.7]),
      ...[-0.7, 0, 0.7].map((x) =>
        part("ball", "#7f9c71", [x, 0.85, 0], [0.55, 0.55, 0.5]),
      ),
    ]),
    recipe("willow", "垂柳", ["river", "garden"], "curb", 2.1, [
      part("cylinder", "#796f5b", [0, 1.8, 0], [0.15, 3.6, 0.15]),
      part("ball", "#739e86", [0, 3.7, 0], [1.6, 0.9, 1.4]),
      ...Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        return part(
          "cone",
          "#81ae8c",
          [Math.cos(a) * 1.3, 2.55, Math.sin(a) * 1.2],
          [0.35, 2.7, 0.3],
          false,
          [Math.PI, 0, 0],
        );
      }),
    ]),
    recipe(
      "reeds",
      "岸边芦苇",
      ["river", "nature"],
      "curb",
      1.2,
      Array.from({ length: 8 }, (_, i) =>
        part(
          "cone",
          i % 2 ? "#b5ad80" : "#92a57b",
          [(i % 4) * 0.4 - 0.6, 0.7, Math.floor(i / 4) * 0.4],
          [0.16, 1.4 + (i % 3) * 0.25, 0.18],
        ),
      ),
    ),
    recipe("boat", "平底小船", ["river", "water"], "water", 2.6, [
      part("box", "#775f50", [0, 0.08, 0], [1.8, 0.45, 4]),
      part("box", "#bfa17a", [0, 0.32, 0], [1.55, 0.07, 3.7]),
      ...[-1, 1].map((s) =>
        part("box", "#866756", [s * 0.9, 0.45, 0], [0.12, 0.5, 4]),
      ),
      part("box", "#b89673", [0, 0.63, 0.5], [1.6, 0.14, 0.38]),
      part(
        "box",
        "#d9c6a3",
        [1.15, 0.7, 0],
        [0.09, 0.09, 3.5],
        false,
        [0, 0.4, 0],
      ),
    ]),
    recipe(
      "pavilion",
      "岸边小亭",
      ["river", "garden", "landmark"],
      "landmark",
      3.2,
      [
        ...[-1, 1].flatMap((x) =>
          [-1, 1].map((z) =>
            part(
              "cylinder",
              "#846354",
              [x * 1.7, 1.7, z * 1.7],
              [0.13, 3.4, 0.13],
            ),
          ),
        ),
        part("box", "#b9b4a0", [0, 0.1, 0], [4.3, 0.25, 4.3]),
        part("cone", "#547c78", [0, 3.7, 0], [3.3, 1.2, 3.3]),
        part("sphere", "#d8b77c", [0, 4.5, 0], [0.2, 0.2, 0.2]),
      ],
    ),
    recipe("mountains", "层叠山峦", ["mountain", "horizon"], "backdrop", 17, [
      part("cone", "#718d98", [-8, 8, -4], [11, 18, 10]),
      part("cone", "#93a8ab", [8, 11, -12], [13, 25, 13]),
      part("cone", "#547982", [0, 5, 5], [12, 12, 8]),
    ]),
    recipe("roof-garden", "露台花架", ["daily", "garden"], "landmark", 3.1, [
      part("box", "#c5b299", [0, 0.8, 0], [4.7, 1.6, 4]),
      ...[-1, 1].map((s) =>
        part("box", "#678b7d", [s * 1.9, 2.3, 0], [0.13, 3, 0.13]),
      ),
      part("box", "#8b7c65", [0, 3.75, 0], [4.6, 0.15, 3]),
      ...[-1, 1].map((s) =>
        part("ball", "#85a17d", [s * 1.8, 1.9, 0.9], [0.65, 0.7, 0.65]),
      ),
    ]),
    recipe(
      "light-fins",
      "几何光柱",
      ["electric", "light"],
      "curb",
      1.3,
      [-1, 0, 1].flatMap((s, i) => [
        part(
          "box",
          "#354351",
          [s * 0.65, 1.6 + i * 0.3, 0],
          [0.18, 3.2 + i * 0.6, 0.32],
        ),
        part(
          "box",
          i % 2 ? "#e58dbf" : "#65d9dc",
          [s * 0.65, 1.6 + i * 0.3, 0.18],
          [0.08, 2.9 + i * 0.6, 0.06],
          true,
        ),
      ]),
    ),
    recipe("lanterns", "暖光灯笼", ["light", "daily"], "curb", 1.5, [
      part("cylinder", "#6c655a", [0, 1.6, 0], [0.06, 3.2, 0.06]),
      part("box", "#6c655a", [0, 3.2, 0], [2.2, 0.1, 0.1]),
      ...[-1, 1].map((s) =>
        part("sphere", "#f2ba71", [s * 0.8, 2.8, 0], [0.3, 0.42, 0.3], true),
      ),
    ]),
  ];
}
export interface RecipeRequest {
  name: string;
  form: "arch" | "beacon" | "sculpture" | "sign";
  color: string;
  tag: string;
}
export function synthesizeRecipe(req: RecipeRequest): Recipe {
  const parts: Part[] = [];
  const c = req.color;
  if (req.form === "arch") {
    for (const s of [-1, 1])
      parts.push(
        part("box", "#394653", [s * 2.3, 2.7, 0], [0.32, 5.4, 0.4]),
        part("box", c, [s * 2.3, 2.7, 0.25], [0.1, 5.1, 0.06], true),
      );
    parts.push(
      part("box", "#394653", [0, 5.3, 0], [4.9, 0.35, 0.4]),
      part("box", c, [0, 5.3, 0.25], [4.7, 0.1, 0.06], true),
    );
  }
  if (req.form === "beacon") {
    parts.push(
      part("cylinder", "#dedacb", [0, 3.5, 0], [0.8, 7, 0.8]),
      part("cylinder", c, [0, 7.1, 0], [1.05, 0.7, 1.05], true),
      part("cone", "#546d78", [0, 7.9, 0], [1.35, 0.9, 1.35]),
    );
  }
  if (req.form === "sculpture") {
    parts.push(part("cylinder", "#6a737b", [0, 0.3, 0], [1.5, 0.6, 1.5]));
    for (let i = 0; i < 5; i++)
      parts.push(
        part(
          "ball",
          c,
          [(i - 2) * 0.55, 1.2 + i * 0.4, 0],
          [0.5, 1.3, 0.5],
          true,
          [0, 0, (i - 2) * 0.18],
        ),
      );
  }
  if (req.form === "sign") {
    parts.push(
      part("box", "#3c4554", [0, 1.7, 0], [0.15, 3.4, 0.15]),
      part("box", "#303c50", [0, 3.1, 0], [2.5, 1.2, 0.2]),
    );
    for (let i = 0; i < 4; i++)
      parts.push(
        part(
          "box",
          i % 2 ? c : "#eed6a1",
          [-0.9 + i * 0.6, 3.1, 0.14],
          [0.12, 0.8, 0.04],
          true,
        ),
      );
  }
  let hash = 2166136261;
  for (const ch of JSON.stringify(req)) {
    hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
  }
  return {
    id: "recipe-" + hash.toString(16),
    version: 1,
    name: req.name.slice(0, 60),
    tags: [req.tag, req.form],
    placement: "landmark",
    footprint: req.form === "arch" ? 3.1 : 2,
    origin: "generated",
    parts,
  };
}
export function validateRecipes(value: unknown): Recipe[] {
  if (!Array.isArray(value) || value.length > 96)
    throw Error("资产库最多 96 个配方");
  const ids = new Set<string>();
  const num = (x: unknown, a: number, b: number) =>
    typeof x === "number" && Number.isFinite(x) && x >= a && x <= b;
  for (const r of value as Recipe[]) {
    if (
      !r ||
      !/^[-a-zA-Z0-9]{1,64}$/.test(r.id) ||
      ids.has(r.id) ||
      !num(r.version, 1, 999) ||
      !Number.isInteger(r.version) ||
      typeof r.name !== "string" ||
      r.name.length > 60 ||
      !["curb", "water", "backdrop", "landmark"].includes(r.placement) ||
      !num(r.footprint, 0.2, 25) ||
      !["builtin", "generated", "imported"].includes(r.origin) ||
      !Array.isArray(r.tags) ||
      r.tags.length > 12 ||
      r.tags.some((t) => typeof t !== "string" || t.length > 40) ||
      !Array.isArray(r.parts) ||
      r.parts.length < 1 ||
      r.parts.length > 64
    )
      throw Error("资产配方信息无效");
    ids.add(r.id);
    if (r.effects !== undefined) validateVisualEffects(r.effects);
    for (const p of r.parts) {
      if (
        !p ||
        ![
          "box",
          "ball",
          "rock",
          "taper",
          "cone",
          "cylinder",
          "sphere",
          "torus",
        ].includes(p.shape) ||
        !/^#[a-f0-9]{6}$/i.test(p.color) ||
        !Array.isArray(p.position) ||
        p.position.length !== 3 ||
        !p.position.every((x) => num(x, -40, 40)) ||
        !Array.isArray(p.scale) ||
        p.scale.length !== 3 ||
        !p.scale.every((x) => num(x, 0.01, 50)) ||
        (p.rotation &&
          (!Array.isArray(p.rotation) ||
            p.rotation.length !== 3 ||
            !p.rotation.every((x) => num(x, -7, 7)))) ||
        (p.role !== undefined && !["solid", "support"].includes(p.role)) ||
        (p.viewRole !== undefined && !["roof", "focus"].includes(p.viewRole)) ||
        (p.feature !== undefined &&
          !/^[a-z][a-z0-9-]{0,59}$/.test(p.feature)) ||
        (p.glow !== undefined && typeof p.glow !== "boolean")
      )
        throw Error("构件几何、颜色或尺度无效");
    }
  }
  return structuredClone(value);
}
export function validateAtmospheres(value: unknown): Atmosphere[] {
  if (!Array.isArray(value) || !value.length || value.length > 32)
    throw Error("氛围库数量无效");
  const ids = new Set();
  for (const a of value as Atmosphere[]) {
    if (!a || typeof a !== "object") throw Error("氛围信息无效");
    for (const [key, min, max] of [
      ["sunElevation", 2, 80],
      ["sunAzimuth", -180, 180],
    ] as const)
      if (
        a[key] !== undefined &&
        (!Number.isFinite(a[key]) || a[key]! < min || a[key]! > max)
      )
        throw Error("太阳方向参数无效");
    if (
      !a ||
      !/^[-a-z0-9]{1,64}$/.test(a.id) ||
      ids.has(a.id) ||
      typeof a.name !== "string" ||
      a.name.length > 60
    )
      throw Error("氛围标识无效");
    ids.add(a.id);
    for (const k of ["sky", "water", "ground", "light", "accent"] as const)
      if (!/^#[a-f0-9]{6}$/i.test(a[k])) throw Error("氛围颜色无效");
    for (const [k, min, max] of [
      ["night", 0, 1],
      ["sun", 0, 4],
      ["fog", 80, 250],
      ["sparkle", 0, 1],
      ["exposure", 0.5, 1.6],
    ] as const)
      if (!Number.isFinite(a[k]) || a[k] < min || a[k] > max)
        throw Error("氛围参数无效");
  }
  return structuredClone(value);
}
