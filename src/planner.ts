import {
  chapterAt,
  duration,
  lyricTime,
  lyricEnd,
  type Plan,
  type Theme,
  type Asset,
} from "./model";
import { synthesizeRecipe, type SectionEvidence, type Need } from "./design";
export interface Signal {
  energy: number[];
  step: number;
  frames?: import("./music-features").MusicFrame[];
}
import { compositionAssets } from "./domain/composition-catalog";
export { compositionAssets } from "./domain/composition-catalog";
const terms: [string, RegExp][] = [
  ["river", /河|江|湖|海|水面|岸|桥|river|ocean|water/i],
  ["mountain", /山|峰|旷野|mountain|horizon/i],
  ["garden", /树|花|柳|林|叶|tree|flower|garden/i],
  ["daily", /街|巷|城|路灯|咖啡|茶|家|street|city|home/i],
  ["transport", /车|站|单车|bus|bicycle/i],
  ["neon", /霓虹|neon/i],
  ["dawn", /破晓|日出|朝阳|曙光|sunrise|dawn/i],
  ["dusk", /黄昏|夕阳|落日|sunset|dusk/i],
  ["moon", /月|moon/i],
  ["night", /夜|星|night|stars/i],
  ["beacon", /灯塔|lighthouse|beacon/i],
  ["sculpture", /晶体|雕塑|crystal|sculpture/i],
];
function tagsFor(text: string, p?: Plan) {
  const tags = terms
    .filter(([, regex]) => regex.test(text))
    .map(([tag]) => tag);
  const lower = text.toLowerCase();
  for (const r of p?.library ?? [])
    if (
      lower.includes(r.name.toLowerCase()) ||
      r.tags.some((t) => lower.includes(t.toLowerCase()))
    )
      tags.push(...r.tags);
  for (const a of p?.atmospheres ?? [])
    if (lower.includes(a.name.toLowerCase())) tags.push("atmosphere:" + a.id);
  return [...new Set(tags)].slice(0, 30);
}
function features(p: Plan, start: number, end: number, signal?: Signal) {
  const from = start + p.audio.clipStart,
    to = end + p.audio.clipStart;
  let energy = 0;
  if (signal?.energy.length) {
    const a = Math.floor(from / signal.step),
      b = Math.ceil(to / signal.step);
    const values = signal.energy.slice(a, b);
    energy = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  }
  const events = p.events.filter(
    (e) => e.enabled && e.time >= from && e.time < to,
  );
  const activity = Math.min(1, events.length / Math.max(1, (end - start) * 2));
  return { energy, activity };
}
export function planSong(input: Plan, signal?: Signal): Plan {
  const p = structuredClone(input),
    d = duration(p),
    boundaries = [0];
  // Boundaries derive from inputs; filenames and song identities are deliberately unused.
  let lastTags = "";
  for (const line of p.lyrics.lines) {
    const t = lyricTime(line, p);
    if (t <= 0 || t >= d - 3) continue;
    const tags = tagsFor(line.text, p).join(",");
    if (tags && tags !== lastTags && t - boundaries.at(-1)! >= 10) {
      boundaries.push(t);
      lastTags = tags;
    }
  }
  if (boundaries.length === 1 && signal?.energy.length) {
    let previous = features(p, 0, Math.min(d, 12), signal);
    for (let t = 12; t < d - 8; t += 12) {
      const current = features(p, t, Math.min(d, t + 12), signal);
      if (
        Math.abs(current.energy - previous.energy) > 0.14 ||
        Math.abs(current.activity - previous.activity) > 0.22
      )
        boundaries.push(t);
      previous = current;
    }
  }
  const cuts = boundaries.filter(
    (_, i) => i % Math.max(1, Math.ceil(boundaries.length / 24)) === 0,
  );
  cuts.push(d);
  const sections: SectionEvidence[] = cuts.slice(0, -1).map((start, i) => {
    const end = cuts[i + 1];
    const lyrics = p.lyrics.lines
      .filter((l) => lyricTime(l, p) < end && lyricEnd(l, p) > start)
      .map((l) => l.text)
      .join(" ");
    const tags = tagsFor(lyrics + " " + p.direction.keywords, p);
    const f = features(p, start, end, signal);
    const evidence = [
      ...(lyrics
        ? [`歌词词汇线索：${lyrics.slice(0, 110)}（规则匹配）`]
        : ["此段没有可用歌词，延续空间或使用人工方向"]),
      ...(p.direction.keywords
        ? [`人工视觉方向：${p.direction.keywords}`]
        : []),
      ...(signal?.energy.length
        ? [
            `平滑能量 ${f.energy.toFixed(2)}，起音活动 ${f.activity.toFixed(2)}；不是节拍或旋律识别`,
          ]
        : ["未获得能量曲线，不推断音乐高潮"]),
    ];
    return { start, end, ...f, contrast: 0, tags, evidence };
  });
  sections.forEach(
    (s, i) =>
      (s.contrast = i ? Math.abs(s.energy - sections[i - 1].energy) : 0),
  );
  const needs: Need[] = [];
  const ensure = (
    tag: string,
    form: "arch" | "beacon" | "sculpture" | "sign",
    name: string,
    color: string,
  ) => {
    const existing = p.library.find((r) => r.tags.includes(tag));
    if (existing) {
      needs.push({
        tag,
        status: "reused",
        asset: existing.id,
        reason: "资产标签命中，复用已注册配方",
      });
      return existing.id;
    }
    if (!p.direction.allowGrowth || p.library.length >= 96) {
      needs.push({
        tag,
        status: "missing",
        asset: "",
        reason: "缺少匹配构件，自动扩充关闭或资产库已满",
      });
      return "";
    }
    const r = synthesizeRecipe({ name, form, color, tag });
    p.library.push(r);
    needs.push({
      tag,
      status: "generated",
      asset: r.id,
      reason: "由受限几何配方组合生成，可保存并供其他歌曲复用",
    });
    return r.id;
  };
  let current: Theme = "shade";
  let currentAtmosphere = "day";
  p.chapters = sections.map((s, i) => {
    const tags = s.tags;
    if (tags.includes("river")) current = "river";
    else if (tags.includes("mountain")) current = "ridge";
    else if (tags.includes("daily")) current = "sunset";
    else if (tags.includes("garden")) current = "shade";
    if (tags.includes("neon")) currentAtmosphere = "neon";
    else if (tags.includes("dawn")) currentAtmosphere = "dawn";
    else if (tags.includes("moon")) currentAtmosphere = "moon";
    else if (tags.includes("night")) currentAtmosphere = "night";
    else if (tags.includes("dusk")) currentAtmosphere = "dusk";
    else if (i === 0)
      currentAtmosphere =
        p.direction.style === "electric"
          ? "night"
          : p.direction.style === "ethereal"
            ? "moon"
            : "day";
    const explicitMood = tags.find((t) => t.startsWith("atmosphere:"));
    if (explicitMood) currentAtmosphere = explicitMood.slice(11);
    const desired = [
      ...(current === "river"
        ? ["river"]
        : current === "ridge"
          ? ["mountain"]
          : ["daily"]),
      ...tags.filter((t) => ["garden", "transport"].includes(t)),
      ...(p.direction.style === "electric" ? ["electric"] : []),
    ];
    const recipes = p.library
      .filter((r) => [...desired, ...tags].some((t) => r.tags.includes(t)))
      .map((r) => r.id)
      .slice(0, 10);
    for (const tag of ["neon", "beacon", "sculpture"])
      if (tags.includes(tag)) {
        const id = ensure(
          tag,
          tag === "neon" ? "arch" : tag === "beacon" ? "beacon" : "sculpture",
          tag === "neon"
            ? "霓虹门廊"
            : tag === "beacon"
              ? "海岸灯塔"
              : "光晶雕塑",
          tag === "neon" ? "#75e6de" : "#edd5ac",
        );
        if (id && !recipes.includes(id)) recipes.push(id);
      }
    for (const id of recipes)
      if (!needs.some((n) => n.asset === id))
        needs.push({
          tag: p.library.find((r) => r.id === id)!.tags[0],
          status: "reused",
          asset: id,
          reason: "根据歌词、空间和人工风格匹配",
        });
    return {
      start: s.start,
      title: tags.length
        ? tags
            .map(
              (t) =>
                ({
                  river: "水岸",
                  mountain: "山峦",
                  garden: "花木",
                  daily: "街巷",
                  transport: "站台",
                  neon: "霓虹",
                  dawn: "破晓",
                  dusk: "黄昏",
                  moon: "月光",
                  night: "夜色",
                  beacon: "灯塔",
                  sculpture: "晶体",
                })[t] ??
                p.atmospheres.find((a) => "atmosphere:" + a.id === t)?.name ??
                p.library.find((r) => r.tags.includes(t))?.name ??
                t,
            )
            .filter(Boolean)
            .slice(0, 3)
            .join(" · ")
        : "延续 · 向前",
      theme: current,
      assets: [...compositionAssets[current]],
      recipes,
      atmosphere: currentAtmosphere,
      pace: Math.max(
        0.78,
        Math.min(
          1.25,
          0.9 +
            s.energy * 0.2 +
            s.activity * 0.2 +
            (p.direction.style === "electric" ? 0.08 : 0),
        ),
      ),
      source: "rule" as const,
      evidence: [
        ...s.evidence,
        `空间 ${current} / 氛围 ${currentAtmosphere}；可独立人工覆盖`,
      ],
      moment: {
        kind: "none" as "none" | "reveal" | "quiet" | "rise",
        duration: Math.max(3, Math.min(18, s.end - s.start)),
        strength: 0.75,
      },
    };
  });
  // Select at most two separated emphasis windows; high volume alone is not sufficient.
  const candidates = sections
    .map((s, i) => ({
      i,
      score:
        s.energy * 0.3 +
        s.contrast * 0.45 +
        s.activity * 0.1 +
        (s.tags.some((t) =>
          ["river", "mountain", "neon", "moon", "dawn"].includes(t),
        )
          ? 0.2
          : 0),
    }))
    .filter(
      ({ i, score }) =>
        score > 0.25 &&
        (sections[i].energy > 0.1 ||
          sections[i].tags.some((t) =>
            ["river", "mountain", "neon", "moon", "dawn"].includes(t),
          )),
    );
  const chosen: number[] = [];
  for (const { i } of candidates.sort((a, b) => b.score - a.score)) {
    if (chosen.length === 2) break;
    if (
      chosen.some(
        (j) =>
          Math.abs(sections[j].start - sections[i].start) <
          Math.max(12, d * 0.2),
      )
    )
      continue;
    chosen.push(i);
    const c = p.chapters[i];
    c.moment!.kind =
      c.theme === "ridge"
        ? "rise"
        : c.theme === "river" || c.atmosphere === "moon"
          ? "quiet"
          : "reveal";
    c.evidence!.push(
      signal?.energy.length
        ? "重点候选依据：段落能量变化与视觉意象共同评分，需人工试听确认"
        : "重点候选仅来自意象，未验证音乐高潮",
    );
  }
  const text =
    p.lyrics.lines.map((l) => l.text).join(" ") + " " + p.direction.keywords;
  for (const request of p.direction.keywords
    .split(/[,，、;；\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20))
    if (!tagsFor(request, p).length)
      needs.push({
        tag: request.slice(0, 80),
        status: "missing",
        asset: "",
        reason:
          "未匹配规则或已注册标签；可创建同名/同标签配方，或补充模型生成器",
      });
  for (const term of ["鲸鱼", "巨龙", "宇宙飞船"])
    if (text.includes(term))
      needs.push({
        tag: term,
        status: "missing",
        asset: "",
        reason: "当前几何配方不能可靠表达，需要新增模型或生成器；未伪造该对象",
      });
  p.analysis = {
    method: "local-rules",
    sections,
    needs: needs
      .filter(
        (n, i, a) =>
          a.findIndex((x) => x.tag === n.tag && x.asset === n.asset) === i,
      )
      .slice(0, 100),
    warnings: [
      "本地规则与能量统计，不是大模型语义理解或主旋律识别。",
      ...(!p.lyrics.lines.length
        ? ["未输入歌词；仅依据音频活动与人工方向编排。"]
        : []),
      ...(/不|没有|回忆|仿佛/.test(text)
        ? ["含否定、回忆或比喻表达，请核对词汇匹配。"]
        : []),
      ...(!signal?.energy.length
        ? ["没有能量曲线，重点镜头只表示视觉建议。"]
        : []),
    ],
  };
  return p;
}
