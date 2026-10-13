import type { Plan } from "./model";
// Reusable retrieval metadata, not per-song scenery. The model still selects time,
// intent, evidence and composition; retrieval prevents unsupported spatial leaps.
export const sequenceCapabilities = [
  { id: "street", requires: [], description: "普通道路、街巷与一盏灯下的停留" },
  {
    id: "bridge",
    requires: [
      "江",
      "河",
      "湖",
      "水岸",
      "岸边",
      "桥头",
      "桥上",
      "river",
      "lake",
      "waterside",
      "bridge",
    ],
    description: "水岸或桥路的开阔停留",
  },
  {
    id: "tavern",
    requires: [
      "酒馆",
      "酒吧",
      "咖啡",
      "茶馆",
      "小店",
      "屋里",
      "屋内",
      "室内",
      "进门",
      "木门",
      "tavern",
      "bar",
      "cafe",
      "indoors",
    ],
    description: "进入室内、短暂停留再离开",
  },
  {
    id: "ridge",
    requires: ["山", "峰", "云海", "松林", "mountain", "ridge", "forest"],
    description: "自然地貌与天际展开，不用于城市楼顶",
  },
  {
    id: "neon",
    requires: [
      "霓虹",
      "城市",
      "街头",
      "高架",
      "楼顶",
      "舞台",
      "吉他",
      "neon",
      "city",
      "punk",
      "stage",
    ],
    description: "城市天际线与电气灯光",
  },
];
export function availableSequences(p: Plan): string[] {
  const text = p.lyrics.lines
    .map((l) => l.text)
    .join(" ")
    .toLowerCase();
  return [
    "none",
    ...sequenceCapabilities
      .filter(
        (c) =>
          !text ||
          !c.requires.length ||
          c.requires.some((t) => text.includes(t)),
      )
      .map((c) => c.id),
  ];
}
