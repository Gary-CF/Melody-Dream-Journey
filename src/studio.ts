import { createBrowserStorage } from "./adapters/scoped-storage";
import { planSong, type Signal } from "./planner";
import { validatePlan, type Plan } from "./model";
import {
  atmospheres,
  momentNames,
  synthesizeRecipe,
  validateRecipes,
  validateAtmospheres,
  type Recipe,
  type RecipeRequest,
} from "./design";
const appStorage = createBrowserStorage();
const storageKey = "melodic-asset-library-v2";
function sameData(a: unknown, b: unknown) {
  const canonical = (v: any): any =>
    Array.isArray(v)
      ? v.map(canonical)
      : v && typeof v === "object"
        ? Object.keys(v)
            .filter((k) => k !== "origin")
            .sort()
            .map((k) => [k, canonical(v[k])])
        : v;
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
export function withLibrary(p: Plan) {
  try {
    const saved = validateRecipes(
      JSON.parse(appStorage.getItem(storageKey) ?? "[]"),
    );
    for (const r of saved)
      if (!p.library.some((x) => x.id === r.id) && p.library.length < 96)
        p.library.push(r);
    const stored = appStorage.getItem(storageKey + "-atmospheres");
    if (stored)
      for (const a of validateAtmospheres(JSON.parse(stored)))
        if (
          !p.atmospheres.some((x) => x.id === a.id) &&
          p.atmospheres.length < 32
        )
          p.atmospheres.push(a);
  } catch {}
  return p;
}
export function saveLibrary(p: Plan) {
  appStorage.setItem(
    storageKey,
    JSON.stringify(p.library.filter((r) => r.origin !== "builtin")),
  );
  appStorage.setItem(
    storageKey + "-atmospheres",
    JSON.stringify(p.atmospheres),
  );
}
export function installStudio(api: {
  get: () => Plan;
  apply: (p: Plan) => boolean;
  signal: () => Signal;
  toast: (s: string) => void;
  preview: (id: string) => void;
}) {
  const panel = document.createElement("aside");
  panel.className = "panel studio";
  panel.id = "studio-panel";
  panel.innerHTML = `<button class="close" aria-label="关闭">×</button><div class="eyebrow">JOURNEY STUDIO / 02</div><h2>让意境决定风景</h2><p class="desc">分析输入 → 视觉需求 → 匹配或扩充资产 → 编排。<br>本地规则生成，可查看依据并人工调整。</p><label class="field">风格方向（人工提示）<select id="direction-style"><option value="auto">自动 / 不预设音乐流派</option><option value="acoustic">温暖、自然、生活感</option><option value="electric">利落、工业、强烈节奏感</option><option value="ethereal">空灵、留白、诗意</option></select></label><label class="field">视觉意象补充<textarea id="direction-words" class="textarea" maxlength="500" placeholder="例如：河岸、月光、柳树；或霓虹、城市街道。&#10;提示参与规划，不等同于自动识别音乐风格。"></textarea></label><label class="field"><input type="checkbox" id="allow-growth" checked> 缺少构件时尝试组合新配方，并存入本机资产库</label><button id="generate-journey" class="primary full">分析输入并生成旅程</button><div id="design-report"></div><div class="section-rule"></div><h3>可复用资产库 <span id="asset-count" class="pill"></span></h3><div id="asset-list"></div><details><summary>扩充一个参数化构件</summary><p class="help">在现有几何能力内生成配方，超出能力的对象会列为缺失需求。</p><label class="field">名称<input id="recipe-name" type="text" value="我的光廊" maxlength="60"></label><div class="row"><label class="field">形态<select id="recipe-form"><option value="arch">门廊</option><option value="beacon">灯塔</option><option value="sculpture">晶体雕塑</option><option value="sign">灯光标识</option></select></label><label class="field">颜色<input type="color" id="recipe-color" value="#78e5df"></label></div><label class="field">用途标签<input id="recipe-tag" type="text" value="neon" maxlength="40"></label><button id="create-recipe" class="secondary full">生成并保存到资产库</button></details><div class="row spacer"><button id="export-library" class="secondary">导出配方库</button><button id="import-library" class="secondary">导入配方库</button></div><input id="library-file" type="file" accept=".json" hidden><p class="help">资产库独立于歌曲保存。计划 JSON 也内含所用配方与氛围，换电脑可还原。配方仅接受几何数据，不执行脚本。</p>`;
  panel.insertAdjacentHTML(
    "beforeend",
    `<details><summary>调配并保存一种氛围</summary><label class="field">以现有氛围为基础<select id="atmosphere-base"></select></label><label class="field">名称<input id="atmosphere-name" type="text" value="我的暮色" maxlength="60"></label><div class="row"><label class="field">天空<input type="color" id="atmosphere-sky" value="#79617e"></label><label class="field">光线<input type="color" id="atmosphere-light" value="#ffd99e"></label></div><button id="create-atmosphere" class="secondary full">保存氛围，供章节选用</button><p class="help">保留基础氛围的雾、灯光、水面与曝光参数。完整参数可通过计划 JSON 编辑。</p></details>`,
  );
  document.getElementById("app")!.append(panel);
  const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const open = () => {
    document
      .querySelectorAll(".panel")
      .forEach((x) => x.classList.toggle("open", x === panel));
    refresh();
  };
  el("open-studio").onclick = open;
  panel.querySelector<HTMLButtonElement>(".close")!.onclick = () =>
    panel.classList.remove("open");
  const settings = () => {
    const p = api.get();
    p.direction = {
      style: el<HTMLSelectElement>("direction-style")
        .value as Plan["direction"]["style"],
      keywords: el<HTMLTextAreaElement>("direction-words").value.trim(),
      allowGrowth: el<HTMLInputElement>("allow-growth").checked,
    };
  };
  for (const id of ["direction-style", "direction-words", "allow-growth"])
    el(id).onchange = settings;
  el("create-atmosphere").onclick = () => {
    try {
      const p = structuredClone(api.get()),
        base = p.atmospheres.find(
          (a) => a.id === el<HTMLSelectElement>("atmosphere-base").value,
        )!;
      const name = el<HTMLInputElement>("atmosphere-name").value.trim();
      if (!name) throw Error("请填写氛围名称");
      const sky = el<HTMLInputElement>("atmosphere-sky").value,
        light = el<HTMLInputElement>("atmosphere-light").value;
      let hash = 0;
      for (const c of name + sky + light + base.id)
        hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
      const a = { ...base, id: "mood-" + hash.toString(16), name, sky, light };
      if (!p.atmospheres.some((x) => x.id === a.id)) p.atmospheres.push(a);
      validateAtmospheres(p.atmospheres);
      if (!api.apply(p))
        throw Error(
          "场景未通过通行检查，未保存本次候选；可在开发检查中导出后修正。",
        );
      saveLibrary(p);
      api.toast("氛围已保存，在章节编排中可独立选用。");
    } catch (e) {
      api.toast((e as Error).message);
    }
  };
  el("generate-journey").onclick = () => {
    settings();
    try {
      const p = validatePlan(planSong(withLibrary(api.get()), api.signal()));
      if (!api.apply(p))
        throw Error(
          "场景未通过通行检查，未保存本次候选；可在开发检查中导出后修正。",
        );
      saveLibrary(p);
      api.toast("旅程已根据当前输入生成。请检查依据、缺失需求及重点候选。");
    } catch (e) {
      api.toast((e as Error).message);
    }
  };
  el("create-recipe").onclick = () => {
    try {
      const p = structuredClone(api.get());
      const name = el<HTMLInputElement>("recipe-name").value.trim(),
        tag = el<HTMLInputElement>("recipe-tag").value.trim();
      if (!name || !tag) throw Error("请填写名称和用途标签");
      const recipe = synthesizeRecipe({
        name,
        tag,
        form: el<HTMLSelectElement>("recipe-form")
          .value as RecipeRequest["form"],
        color: el<HTMLInputElement>("recipe-color").value,
      });
      if (!p.library.some((r) => r.id === recipe.id)) p.library.push(recipe);
      validateRecipes(p.library);
      if (!api.apply(p))
        throw Error(
          "场景未通过通行检查，未保存本次候选；可在开发检查中导出后修正。",
        );
      saveLibrary(p);
      api.preview(recipe.id);
      api.toast("构件已生成并持久保存；以后按用途标签可直接复用。");
    } catch (e) {
      api.toast((e as Error).message);
    }
  };
  el("export-library").onclick = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              schemaVersion: 1,
              recipes: api.get().library,
              atmospheres: api.get().atmospheres,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "journey-asset-library.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  el("import-library").onclick = () =>
    el<HTMLInputElement>("library-file").click();
  el<HTMLInputElement>("library-file").onchange = async (e) => {
    const input = e.target as HTMLInputElement;
    try {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 1024 * 1024) throw Error("资产文件最多 1 MB");
      const data = JSON.parse(await file.text());
      if (data.schemaVersion !== 1) throw Error("资产库版本无效");
      const recipes = validateRecipes(data.recipes);
      const p = structuredClone(api.get());
      for (const r of recipes) {
        const existing = p.library.find((x) => x.id === r.id);
        if (existing) {
          if (!sameData(existing, r))
            throw Error("存在不同内容的同名资产：" + r.id + "，请使用新 id");
        } else p.library.push({ ...r, origin: "imported" });
      }
      validateRecipes(p.library);
      if (data.atmospheres) {
        for (const a of validateAtmospheres(data.atmospheres)) {
          const existing = p.atmospheres.find((x) => x.id === a.id);
          if (existing && JSON.stringify(existing) !== JSON.stringify(a))
            throw Error("同名氛围内容不同，请使用新 id：" + a.id);
          if (!existing) p.atmospheres.push(a);
        }
        validateAtmospheres(p.atmospheres);
      }
      if (!api.apply(p))
        throw Error(
          "场景未通过通行检查，未保存本次候选；可在开发检查中导出后修正。",
        );
      saveLibrary(p);
      api.toast("资产库已合并并保存，可跨歌曲复用");
    } catch (e) {
      api.toast((e as Error).message);
    }
    input.value = "";
  };
  function refresh() {
    const p = api.get();
    const base = el<HTMLSelectElement>("atmosphere-base");
    const selected = base.value;
    base.replaceChildren();
    p.atmospheres.forEach((a) =>
      base.add(new Option(a.name, a.id, a.id === selected, a.id === selected)),
    );
    el<HTMLSelectElement>("direction-style").value = p.direction.style;
    el<HTMLTextAreaElement>("direction-words").value = p.direction.keywords;
    el<HTMLInputElement>("allow-growth").checked = p.direction.allowGrowth;
    const report = el("design-report");
    report.replaceChildren();
    for (const warning of p.analysis.warnings) {
      const n = document.createElement("p");
      n.className = "help";
      n.textContent = warning;
      report.append(n);
    }
    const heading = document.createElement("h3");
    heading.textContent = "视觉需求与编排依据";
    report.append(heading);
    for (const n of p.analysis.needs) {
      const item = document.createElement("div");
      item.className = "need " + n.status;
      item.textContent = `${n.status === "missing" ? "待补充" : n.status === "generated" ? "新配方" : "已复用"} · ${n.tag} / ${p.library.find((r) => r.id === n.asset)?.name ?? n.asset}`;
      const reason = document.createElement("small");
      reason.textContent = n.reason;
      item.append(reason);
      report.append(item);
    }
    p.chapters.forEach((c, i) => {
      const details = document.createElement("details"),
        summary = document.createElement("summary");
      summary.textContent = `${i + 1}. ${c.start.toFixed(1)}s · ${c.title} · ${momentNames[c.moment?.kind ?? "none"]}`;
      details.append(summary);
      for (const text of c.evidence ?? []) {
        const line = document.createElement("p");
        line.className = "help";
        line.textContent = text;
        details.append(line);
      }
      report.append(details);
    });
    el("asset-count").textContent = `${p.library.length + 10} 个构件`;
    const list = el("asset-list");
    list.replaceChildren();
    for (const r of p.library) {
      const item = document.createElement("button");
      item.className = "asset-item";
      item.textContent = `${r.name} · v${r.version}${r.origin !== "builtin" ? " / 已保存" : ""}`;
      item.title = r.tags.join(" · ") + " / " + r.placement;
      item.onclick = () => {
        api.preview(r.id);
        panel.classList.remove("open");
      };
      list.append(item);
    }
  }
  return refresh;
}
