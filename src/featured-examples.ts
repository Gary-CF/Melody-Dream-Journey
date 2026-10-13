import {
  loadFeatured,
  readExamples,
  saveExample,
  removeExample,
  validateExample,
  exampleRenderer,
  type SavedExample,
} from "./adapters/featured-examples";
import type { KeyValueStore } from "./adapters/scoped-storage";
import type { Plan } from "./model";
import "./featured-examples.css";

export function installFeaturedExamples(api: {
  store: KeyValueStore;
  get(): { plan: Plan; time: number };
  apply(plan: Plan, time: number): void;
  seek(time: number): void;
  panel(name: string): void;
  toast(message: string): void;
  restored: boolean;
}) {
  const params = new URLSearchParams(location.search);
  const requested = params.get("featured") ?? params.get("saved-example");
  const readonly = !!requested && !params.has("copy");
  if (readonly) document.body.classList.add("example-readonly");
  const open = document.createElement("button");
  open.id = "open-featured";
  open.className = "ghost";
  open.textContent = "✧ 精选示例";
  document.querySelector(".header-actions")!.prepend(open);
  if (requested) {
    const home = document.createElement("a");
    home.id = "example-home";
    home.className = "ghost";
    home.href = new URL(location.pathname, location.origin).href;
    home.textContent = "← 返回主页";
    document.querySelector(".header-actions")!.prepend(home);
  }
  const panel = document.createElement("aside");
  panel.className = "panel featured-panel";
  panel.id = "featured-panel";
  panel.innerHTML = `<button class="close" aria-label="关闭精选示例">×</button><h2>值得停留的旅程</h2>
    <p class="desc">查看原版，或复制后继续创作。示例在新标签页打开，当前旅程会保留。</p>
    <div id="featured-cards">正在读取精选示例…</div><h3>我的保存版本</h3>
    <p class="help">每次保存都是独立版本，包含完整计划、组件与氛围库。仅存在本浏览器，建议导出备份；不包含录音，跨引擎版本的画面可能不同。</p>
    <label class="field">版本名称<input id="example-title" maxlength="80" placeholder="为这次旅程起个名字"></label>
    <button id="save-example" class="primary full">保存当前版本（含当前时刻）</button>
    <button id="import-example" class="secondary full spacer">导入示例包</button><input id="example-file" type="file" accept=".json,application/json" hidden>
    <div id="saved-example-cards"></div>`;
  document.getElementById("app")!.append(panel);
  panel.querySelector<HTMLButtonElement>(".close")!.onclick = () =>
    api.panel("none");
  open.onclick = () => {
    renderSaved();
    api.panel("featured");
  };
  const get = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const guard = (action: () => void) => {
    try {
      action();
    } catch (error) {
      api.toast((error as Error).message);
    }
  };
  const download = (e: SavedExample) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${e.id}.journey.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const link = (
    e: SavedExample,
    featured: boolean,
    copy: boolean,
    time?: number,
  ) => {
    const url = new URL(location.pathname, location.origin);
    url.searchParams.set(featured ? "featured" : "saved-example", e.id);
    if (copy) url.searchParams.set("copy", crypto.randomUUID());
    if (time !== undefined) url.searchParams.set("at", String(time));
    return url.href;
  };
  const card = (e: SavedExample, featured: boolean, cover?: string) => {
    const node = document.createElement("article");
    node.className = "example-card";
    if (cover) {
      const img = document.createElement("img");
      img.src = new URL(`./featured/${cover}`, location.href).href;
      img.alt = e.title;
      node.append(img);
    }
    const title = document.createElement("h3");
    title.textContent = e.title;
    node.append(title);
    const note = document.createElement("p");
    note.className = "help";
    note.textContent = `${e.source.note} · ${e.createdAt.slice(0, 10)}`;
    node.append(note);
    const provenance = document.createElement("details");
    const summary = document.createElement("summary");
    summary.textContent = "来源版本";
    const version = document.createElement("p");
    version.className = "help";
    version.textContent = e.source.renderer;
    provenance.append(summary, version);
    node.append(provenance);
    const actions = document.createElement("div");
    actions.className = "example-actions";
    node.append(actions);
    const anchor = (label: string, copy: boolean, time?: number) => {
      const a = document.createElement("a");
      a.textContent = label;
      a.href = link(e, featured, copy, time);
      a.target = "_blank";
      a.rel = "noopener";
      a.className = "secondary";
      actions.append(a);
    };
    anchor("查看原版", false);
    anchor("复制并编辑", true);
    for (const h of e.highlights)
      anchor(`${h.title} · ${h.time}s`, false, h.time);
    const exp = document.createElement("button");
    exp.className = "secondary";
    exp.textContent = "导出示例包";
    exp.onclick = () => download(e);
    actions.append(exp);
    if (!featured) {
      const del = document.createElement("button");
      del.className = "ghost";
      del.textContent = "删除";
      del.onclick = () => {
        if (confirm(`删除「${e.title}」的本机版本？请先导出需要保留的版本。`))
          guard(() => {
            removeExample(api.store, e.id);
            renderSaved();
          });
      };
      actions.append(del);
    }
    return node;
  };
  function renderSaved() {
    guard(() => {
      const list = readExamples(api.store);
      get("saved-example-cards").replaceChildren(
        ...list.map((e) => card(e, false)),
      );
      if (!list.length)
        get("saved-example-cards").textContent = "还没有保存的版本。";
    });
  }
  get("save-example").onclick = () =>
    guard(() => {
      const { plan, time } = api.get();
      const title = get<HTMLInputElement>("example-title").value.trim();
      if (!title) throw Error("请先填写版本名称");
      saveExample(api.store, {
        format: "melodic-journey-example",
        version: 1,
        id: crypto.randomUUID(),
        title,
        createdAt: new Date().toISOString(),
        source: {
          renderer: exampleRenderer,
          note: "本机保存的创作版本；录音需自行重新选择。",
          ...(requested ? { parent: requested } : {}),
        },
        highlights: [{ title: "保存时刻", time }],
        plan,
      });
      renderSaved();
      api.toast("已保存独立版本；可导出备份");
    });
  get("import-example").onclick = () =>
    get<HTMLInputElement>("example-file").click();
  get<HTMLInputElement>("example-file").onchange = async (event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw Error("示例包不能超过 2MB");
      const e = validateExample(JSON.parse(await file.text()));
      // A restore is a new local version; it cannot replace an existing original.
      saveExample(api.store, {
        ...e,
        id: crypto.randomUUID(),
        source: { ...e.source, parent: e.id },
      });
      renderSaved();
      api.toast("已导入为新的本机版本");
    } catch (error) {
      api.toast((error as Error).message);
    } finally {
      input.value = "";
    }
  };
  const show = (e: SavedExample) => {
    const at = Number(params.get("at") ?? e.highlights[0]?.time ?? 0);
    if (!api.restored || readonly)
      api.apply(e.plan, Number.isFinite(at) ? at : 0);
    const banner = document.createElement("div");
    banner.className = "example-banner";
    const name = document.createElement("span");
    name.textContent = `${e.title} · ${readonly ? "原版只读" : "可编辑副本"} · 当前引擎回放`;
    banner.append(name);
    if (readonly) {
      const copy = document.createElement("a");
      copy.href = link(e, params.has("featured"), true, api.get().time);
      copy.target = "_blank";
      copy.rel = "noopener";
      copy.textContent = "复制并编辑 ↗";
      banner.append(copy);
    }
    for (const h of e.highlights) {
      const b = document.createElement("button");
      b.textContent = h.title;
      b.onclick = () => api.seek(h.time);
      banner.append(b);
    }
    document.getElementById("app")!.append(banner);
  };
  if (params.has("saved-example"))
    guard(() => {
      const e = readExamples(api.store).find((e) => e.id === requested);
      if (!e) throw Error("此本机版本不存在；请从导出的示例包恢复");
      show(e);
    });
  void loadFeatured(location.href)
    .then((entries) => {
      get("featured-cards").replaceChildren(
        ...entries.map(({ entry, example }) =>
          card(example, true, entry.cover),
        ),
      );
      if (params.has("featured")) {
        const e = entries.find(({ example }) => example.id === requested);
        if (!e) throw Error("未找到此精选示例");
        show(e.example);
      }
    })
    .catch((error) => {
      get("featured-cards").textContent = (error as Error).message;
      api.toast((error as Error).message);
    });
  renderSaved();
}
