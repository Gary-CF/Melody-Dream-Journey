export const coreAssets = [
  ["sakura", "江畔樱树", "自然"],
  ["osmanthus", "金桂古树", "自然"],
  ["willow", "垂柳", "自然"],
  ["pine", "山松", "自然"],
  ["pavilion", "临水重檐亭", "建筑"],
  ["moonGate", "月洞门", "建筑"],
  ["redBridge", "朱红木桥", "道路"],
  ["stoneBridge", "石拱桥", "道路"],
  ["stoneLantern", "石灯笼", "灯具"],
  ["paperLantern", "悬挂纸灯", "灯具"],
  ["rocks", "江岸叠石", "自然"],
  ["mountain", "层叠山峦", "远景"],
  ["ridge", "连绵褶皱山脊", "远景"],
  ["stoneArch", "风蚀岩拱", "自然"],
  ["reeds", "岸边芦苇", "自然"],
  ["lotus", "荷叶与花", "自然"],
  ["tavern", "暖灯酒馆", "建筑"],
  ["bar", "木质吧台", "室内"],
  ["table", "圆桌与杯盏", "室内"],
  ["stool", "木凳", "室内"],
  ["shelves", "酒瓶陈列架", "室内"],
  ["lattice", "木格窗", "室内"],
  ["pendant", "室内吊灯", "灯具"],
  ["neon", "霓虹街牌", "城市"],
  ["truss", "工业桁架", "城市"],
  ["beacon", "城市光塔", "远景"],
].map(([id, name, category]) => ({
  id: "core-" + id,
  name,
  category,
  source: "本项目原创程序化几何",
  status: "可渲染原型",
  tags:
    category === "自然"
      ? ["garden", "nature"]
      : category === "建筑"
        ? ["architecture", "daily"]
        : category === "城市"
          ? ["neon", "electric"]
          : category === "灯具"
            ? ["light", "night"]
            : category === "远景"
              ? ["landscape", "vast"]
              : ["daily", "interior"],
  placement: (["mountain", "ridge", "beacon"].includes(id)
    ? "backdrop"
    : id === "lotus"
      ? "water"
      : [
            "sakura",
            "osmanthus",
            "willow",
            "pine",
            "pavilion",
            "moonGate",
            "tavern",
            "stoneArch",
          ].includes(id)
        ? "landmark"
        : "curb") as import("./design").Placement,
  footprint: ["mountain", "ridge"].includes(id)
    ? 40
    : ["sakura", "osmanthus", "willow", "pine"].includes(id)
      ? 10
      : ["pavilion", "tavern", "stoneArch"].includes(id)
        ? 8
        : 3,
  sequenceOnly: [
    "tavern",
    "redBridge",
    "stoneBridge",
    "pendant",
    "shelves",
    "lattice",
  ].includes(id),
}));
