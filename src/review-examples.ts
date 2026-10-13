import { defaults, type Plan } from "./model";
export function examplePlan(id: string): Plan {
  const p = defaults("city");
  p.audio.duration = 96;
  p.audio.clipEnd = 96;
  p.audio.name = "原创验收样段（静音时间轴）";
  p.audio.fingerprint = "";
  p.path.turnTimes = [24, 48, 72];
  p.path.speed = 4.2;
  const base = p.chapters[0];
  p.chapters = [
    {
      ...base,
      start: 0,
      title: "雨将至 · 街巷",
      atmosphere: "dusk",
      theme: "shade",
      director: { view: "overhead", transition: 8 },
      weather: {
        kind: "cloudy",
        intensity: 0.65,
        context: "present",
        evidence: "人工验收时间线，隔离检查渲染",
      },
    },
    {
      ...base,
      start: 16,
      title: "细雨落在街灯上",
      atmosphere: "dusk",
      theme: "night",
      assets: ["shop", "lamp", "tree", "bench"],
      director: { view: "eye", transition: 10 },
      weather: {
        kind: "drizzle",
        intensity: 1,
        context: "present",
        evidence: "人工验收：渐入细雨",
      },
    },
    {
      ...base,
      start: 42,
      title: "夜雨与暖窗",
      atmosphere: "night",
      theme: "night",
      assets: ["shop", "home", "lamp"],
      director: { view: "eye", transition: 10 },
      weather: {
        kind: "rain",
        intensity: 0.85,
        context: "present",
        evidence: "人工验收：夜雨",
      },
    },
    {
      ...base,
      start: 70,
      title: "雨停 · 江面余光",
      atmosphere: "moon",
      theme: "river",
      assets: ["flowerTree", "lamp", "bench"],
      director: { view: "overhead", transition: 12 },
      weather: {
        kind: "afterRain",
        intensity: 1,
        context: "present",
        evidence: "人工验收：雨停后地面仍湿润",
      },
    },
  ];
  p.analysis.warnings = [
    "这是人工编排的能力验收样段，不代表自动模型分析质量。",
  ];
  if (
    ["bridge", "tavern", "combined", "neon", "ridge", "street"].includes(id)
  ) {
    p.path.turnTimes = [20, 75];
    p.chapters = [
      { ...p.chapters[0], start: 0, title: "街巷 · 铺垫", atmosphere: "dusk" },
      {
        ...p.chapters[3],
        start: 22,
        title: "江畔 · 停下来听一会儿",
        atmosphere: "moon",
        director: { view: "overhead", transition: 12 },
        weather: {
          kind: "afterRain",
          intensity: 0.4,
          context: "present",
          evidence: "人工验收样段",
        },
      },
    ];
    p.chapters[1].assets = ["lamp", "bench"];
    p.chapters[1].recipes = [];
    p.sequences = [
      {
        id: "review-bridge",
        kind:
          id === "ridge"
            ? "ridge"
            : id === "neon"
              ? "neon"
              : id === "street"
                ? "street"
                : "bridge",
        focus: id === "neon" ? "neon" : "blossom",
        start: 30,
        end: 58,
        reason: "人工验收：验证人物驻足与大景观构图，不代表自动分析",
        source: "review",
        lyricIds: [],
      },
    ];
    if (id === "neon") {
      p.chapters[1].atmosphere = "neon";
      p.chapters[1].theme = "night";
    }
    if (id === "ridge") {
      p.chapters[1].atmosphere = "dawn";
      p.chapters[1].theme = "ridge";
    }
  }
  if (id === "tavern") {
    p.chapters[1] = {
      ...p.chapters[1],
      title: "走进暖灯里的酒馆",
      theme: "night",
      atmosphere: "night",
      weather: {
        kind: "rain",
        intensity: 0.9,
        context: "present",
        evidence: "人工验收：室内遮雨与暖灯",
      },
    };
    p.sequences![0].kind = "tavern";
    p.sequences![0].focus = "lantern";
  }
  if (id === "combined") {
    p.sequences![0] = {
      ...p.sequences![0],
      id: "review-tavern",
      kind: "tavern",
      focus: "lantern",
      start: 15,
      end: 43,
    };
    p.sequences!.push({
      id: "review-bridge",
      kind: "bridge",
      focus: "osmanthus",
      start: 60,
      end: 88,
      reason: "人工验收：两个完整桥段",
      source: "review",
      lyricIds: [],
    });
    p.path.turnTimes = [];
    p.chapters = [
      {
        ...p.chapters[0],
        start: 0,
        title: "夜雨 · 暖灯小店",
        theme: "night",
        atmosphere: "night",
        weather: {
          kind: "rain",
          intensity: 0.75,
          context: "present",
          evidence: "人工样段",
        },
      },
      {
        ...p.chapters[1],
        start: 48,
        title: "雨停 · 江畔金桂",
        theme: "river",
        atmosphere: "moon",
      },
    ];
  }
  if (id === "street") {
    p.chapters[1].theme = "night";
    p.chapters[1].title = "路尾一灯 · 安静收束";
    p.chapters[1].atmosphere = "night";
    p.sequences![0].focus = "lantern";
  }
  return p;
}
