import type { Plan } from "./model";
import { sequenceNames } from "./sequences";
import { weatherNames } from "./weather";
export function installExperienceReview(api: {
  get: () => Plan;
  apply: (p: Plan) => boolean;
  seek: (t: number) => void;
}) {
  const box = document.createElement("section");
  box.className = "experience-review";
  box.innerHTML =
    '<h3>天气与全曲重点</h3><p class="help">先检查系统提出的意图，再听看画面。固定样段用于隔离渲染问题。</p><div id="experience-coverage"></div><div id="experience-sequences"></div><details><summary>开发验收与功能回退</summary><p class="help">关闭桥段会同时回退人物行动、场景及对应构图；不会删掉分析依据。</p><label class="field"><span><input id="feature-weather" type="checkbox" checked> 启用天气与湿润响应</span></label><label class="field"><span><input id="feature-sequences" type="checkbox" checked> 启用完整桥段</span></label><p><a href="./help.html" target="_blank">MVP 使用说明 ↗</a>　<a href="./asset-lab.html" target="_blank">24 项核心资产实验室 ↗</a></p><label class="field">固定能力样段<select id="review-sample"></select></label></details>';
  box.querySelector("#review-sample")!.innerHTML = [
    ["", "选择样段（新页打开）"],
    ["rain", "细雨 → 夜雨 → 雨停"],
    ["bridge", "江畔樱树 · 桥上驻足"],
    ["tavern", "雨中酒馆 · 进入环视"],
    ["combined", "酒馆 → 江畔金桂"],
    ["ridge", "山峦破晓"],
    ["neon", "霓虹天际"],
    ["street", "路尾一灯"],
  ]
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  document.getElementById("evidence-timeline")!.after(box);
  const $ = <E extends HTMLElement = HTMLElement>(id: string) =>
    box.querySelector<E>("#" + id)!;
  for (const key of ["weather", "sequences"] as const)
    $<HTMLInputElement>("feature-" + key).onchange = () => {
      const p = structuredClone(api.get());
      p.features = {
        ...p.features,
        [key]: $<HTMLInputElement>("feature-" + key).checked,
      };
      if (!api.apply(p))
        $<HTMLInputElement>("feature-" + key).checked =
          api.get().features?.[key] !== false;
    };
  $<HTMLSelectElement>("review-sample").onchange = () => {
    const id = $<HTMLSelectElement>("review-sample").value;
    if (id)
      window.open(location.pathname + "?example=" + id, "_blank", "noopener");
    $<HTMLSelectElement>("review-sample").value = "";
  };
  return () => {
    const p = api.get(),
      coverage = $("experience-coverage");
    coverage.replaceChildren();
    const row = document.createElement("p");
    row.className = "help";
    row.textContent =
      p.narrative?.provider === "semantic-model"
        ? "本地语义分析：分段解释 → 原文天气核验 → 全曲重点选择"
        : "当前为能力预览或声学预编排；没有语义证据时不宣称理解歌词。";
    coverage.append(row);
    for (const c of p.chapters) {
      const item = document.createElement("div");
      item.className = "coverage-row";
      item.textContent = `${Math.floor(c.start)}s · ${c.title} · ${c.weather ? weatherNames[c.weather.kind] : "天气未分析"}`;
      item.title = c.weather?.evidence ?? "旧计划可重新分析以获得天气依据";
      coverage.append(item);
    }
    const list = $("experience-sequences");
    list.replaceChildren();
    if (!p.sequences?.length) {
      const t = document.createElement("p");
      t.className = "help";
      t.textContent =
        "尚无可执行重点桥段。旧分析需重新分析；片段过短或人工锁定也可能限制桥段安排。";
      list.append(t);
    }
    for (const seq of p.sequences ?? []) {
      const card = document.createElement("article");
      card.className = "sequence-card";
      const title = document.createElement("strong");
      title.textContent = `${sequenceNames[seq.kind]} · ${seq.start.toFixed(1)}—${seq.end.toFixed(1)}s`;
      const reason = document.createElement("p");
      reason.textContent = seq.reason;
      const source = document.createElement("small");
      source.textContent =
        seq.source === "review"
          ? "人工能力验收样段"
          : "模型全曲选择 · " +
            (seq.lyricIds.map((i) => "L" + i).join("、") ||
              "声学启发，无歌词事实");
      const buttons = document.createElement("div");
      for (const [label, phase] of [
        ["看铺垫", 0],
        ["看驻足", 0.5],
        ["看离开", 0.85],
      ] as const) {
        const b = document.createElement("button");
        b.className = "secondary";
        b.textContent = label;
        b.onclick = () => api.seek(seq.start + (seq.end - seq.start) * phase);
        buttons.append(b);
      }
      card.append(title, reason, source, buttons);
      list.append(card);
    }
    for (const key of ["weather", "sequences"] as const)
      $<HTMLInputElement>("feature-" + key).checked =
        p.features?.[key] !== false;
  };
}
