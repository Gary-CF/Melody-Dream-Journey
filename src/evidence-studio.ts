import { getModelStatus } from "./adapters/model-status";
import { createBrowserStorage } from "./adapters/scoped-storage";
import { validatePlan, type Plan } from "./model";
import { weatherNames } from "./weather";
import type { Signal } from "./planner";
import {
  applyDraft,
  audioBinding,
  createDraft,
  evidenceFor,
  importStructure,
  inputKey,
  intentions,
  isStale,
  validateNarrative,
  viewpoints,
  type NarrativeDraft,
} from "./narrative";
const appStorage = createBrowserStorage();

export function installEvidenceStudio(api: {
  analyze: (correctionOnly?: boolean) => Promise<void>;
  undoAuto: () => void;
  get: () => Plan;
  apply: (p: Plan) => boolean;
  signal: () => Signal;
  seek: (t: number) => void;
  toast: (s: string) => void;
}) {
  const panel = document.createElement("aside");
  panel.id = "evidence-panel";
  panel.className = "panel evidence-studio";
  panel.innerHTML = `<button class="close" aria-label="关闭叙事工作台">×</button><div class="eyebrow">ROUND 02 / EVIDENCE & DIRECTION</div><h2>先看懂，再编排</h2><p class="desc">音乐与歌词导入后自动分析。先听系统的理解，再补充你想表达的部分。</p><div class="evidence-note"><span id="model-status">正在检查语义服务配置…</span><br>分段音乐证据、光影渐变与多视角已联动。</div><div class="row spacer"><button id="auto-analyze" class="primary">自动分析并生成旅程</button><button id="auto-undo" class="secondary">撤回自动编排</button></div><p id="auto-status" role="status"></p><label class="field">我的补充（可留空，仅修正系统理解）<textarea id="auto-correction" class="textarea" maxlength="500" placeholder="例如：最后一段我想保留温暖，路尽头留一盏灯；前面的场景不变。"></textarea></label><button id="auto-correct" class="secondary full">在自动分析上应用补充</button><details><summary>高级：结构与人工编排</summary><div class="row spacer"><button id="draft-create" class="primary">建立 / 更新草案</button><button id="structure-import" class="secondary">导入结构 JSON</button></div><input id="structure-file" type="file" accept=".json" hidden><p class="help">兼容 All-In-One 的 segments / beats / downbeats，全部使用整曲秒数。请选择对应录音的分析文件；接口不会仅凭同名文件确认版本匹配。<a href="./examples/structure-demo.json" download>示例格式（手写测试数据）</a></p></details><p id="draft-status" role="status"></p><label class="field">系统对整曲演进的理解<textarea id="draft-thesis" class="textarea" maxlength="500" placeholder="例如：从生活里的陪伴，逐渐转向距离感，最后保留温暖的余韵。"></textarea></label><canvas id="evidence-wave" width="850" height="88" aria-label="片段能量和结构边界"></canvas><div id="evidence-timeline" class="evidence-timeline"></div><p class="help">能量只表示强弱；起音不是准确拍点。空白数据表示未知。切换片段后，旧结构需重新关联；改歌词后需更新草案。带锁段保留人工决定。</p><div id="evidence-rows"></div><div class="evidence-actions"><button id="draft-apply" class="primary">应用草案到画面</button><button id="draft-undo" class="secondary">撤回本次应用</button><button id="draft-save" class="secondary">保存草案到本机</button></div><p class="help">应用氛围、标题、段落和机位；自动分析的音乐与歌词依据保留。保存包含在整份计划中，也可用旅程设置导出 JSON。撤回只保留本次会话最近一次应用前的章节与分析。</p>`;
  document.getElementById("app")!.append(panel);
  panel
    .querySelector("#evidence-wave")!
    .before(panel.querySelector(".evidence-actions")!);
  document.getElementById("generate-journey")!.textContent =
    "第一轮规则 · 生成对照版本";
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const entry = document.createElement("button");
  entry.id = "open-evidence";
  entry.className = "primary full";
  entry.textContent = "第二轮 · 叙事与证据工作台 ↗";
  document.querySelector("#studio-panel h2")!.after(entry);
  $("auto-analyze").onclick = () => void api.analyze();
  $("auto-undo").onclick = () => api.undoAuto();
  $("auto-correct").onclick = () => {
    const p = api.get();
    if (!p.narrative?.automatic) return api.toast("请先自动分析音乐与歌词。");
    p.narrative.automatic.correction =
      $<HTMLTextAreaElement>("auto-correction").value.trim();
    void api.analyze(true);
  };
  getModelStatus()
    .then((s) => {
      $("model-status").textContent = s.configured
        ? `分段分析：${s.model} · ${s.detail ?? ""} · ${s.sends === "local" ? "本机处理" : "歌词和特征发送至所配置服务"}${s.creative?.configured ? `；逐曲创作：${s.creative.model}` : ""}`
        : "语义模型未配置 · 当前可运行声学预编排，尚不能理解歌词意境";
    })
    .catch(
      () =>
        ($("model-status").textContent = "语义服务不可用；可运行声学预编排"),
    );
  let undo:
    | {
        binding: string;
        chapters: Plan["chapters"];
        analysis: Plan["analysis"];
      }
    | undefined;
  const safe = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      api.toast((e as Error).message);
    }
  };
  entry.onclick = () => {
    document
      .querySelectorAll(".panel")
      .forEach((x) => x.classList.toggle("open", x === panel));
    refresh();
  };
  panel.querySelector<HTMLButtonElement>(".close")!.onclick = () =>
    panel.classList.remove("open");
  const change = (fn: (d: NarrativeDraft) => void) =>
    safe(() => {
      const p = api.get();
      if (!p.narrative) throw Error("请先建立草案");
      const d = structuredClone(p.narrative);
      fn(d);
      validateNarrative(d, p);
      p.narrative = d;
      refresh();
    });
  $("draft-create").onclick = () =>
    safe(() => {
      const p = api.get();
      if (p.narrative?.automatic) {
        void api.analyze();
        return;
      }
      p.narrative = createDraft(p);
      refresh();
      api.toast(
        "人工草案已更新；上方自动分析入口可重新结合歌词与音乐理解意境。",
      );
    });
  $("structure-import").onclick = () =>
    $<HTMLInputElement>("structure-file").click();
  $("structure-file").onchange = async (e) => {
    const input = e.target as HTMLInputElement;
    try {
      const f = input.files?.[0];
      if (!f) return;
      if (f.size > 2 * 1024 * 1024) throw Error("结构 JSON 最多 2 MB");
      const p = api.get();
      const structure = importStructure(JSON.parse(await f.text()), p);
      p.narrative = createDraft(p, structure);
      refresh();
      api.toast("结构已关联当前录音。请试听核对边界，画面尚未改变。");
    } catch (e) {
      api.toast((e as Error).message);
    }
    input.value = "";
  };
  $("draft-thesis").onchange = () =>
    change((d) => (d.thesis = $<HTMLTextAreaElement>("draft-thesis").value));
  $("draft-apply").onclick = () =>
    safe(() => {
      const p = api.get(),
        next = validatePlan(applyDraft(p));
      const previous = {
        binding: inputKey(p),
        chapters: structuredClone(p.chapters),
        analysis: structuredClone(p.analysis),
      };
      if (!api.apply(next))
        throw Error("草案未通过通行检查，已保留上一有效画面。");
      undo = previous;
      refresh();
      api.toast("氛围、章节与机位已应用，可撤回对比。");
    });
  $("draft-undo").onclick = () =>
    safe(() => {
      const p = api.get();
      if (!undo || undo.binding !== inputKey(p))
        throw Error("没有可撤回版本，或输入已变化");
      const next = structuredClone(p);
      next.chapters = undo.chapters;
      next.analysis = undo.analysis;
      if (!api.apply(validatePlan(next)))
        throw Error("撤回候选未通过通行检查，当前画面保持不变。");
      undo = undefined;
      refresh();
      api.toast("已恢复本次应用前的章节；编辑草案仍保留。");
    });
  $("draft-save").onclick = () =>
    safe(() => {
      const p = validatePlan(api.get());
      appStorage.setItem("melodic-journey", JSON.stringify(p));
      api.toast("草案随计划保存到本机。");
    });
  function refresh() {
    const p = api.get(),
      d = p.narrative,
      stale = isStale(p);
    $("draft-status").textContent = !d
      ? "尚未建立草案，现有画面保持不变。"
      : `${stale ? "输入已变化 · 草案待更新" : "草案与当前输入一致"} / ${d.provider === "semantic-model" ? "语义模型 + 分段音乐证据" : d.provider === "acoustic-fallback" ? "声学预编排 · 歌词意境尚未理解" : d.provider === "existing-plan" ? "人工章节" : "外部结构 JSON"} / ${d.segments.filter((s) => s.locked).length} 段已锁定`;
    $("draft-status").className = stale
      ? "evidence-note stale"
      : "evidence-note";
    $<HTMLButtonElement>("draft-apply").disabled = !d || stale;
    $<HTMLButtonElement>("draft-undo").disabled =
      !undo || undo.binding !== inputKey(p);
    $<HTMLTextAreaElement>("draft-thesis").disabled = !d;
    $<HTMLTextAreaElement>("draft-thesis").value = d?.thesis ?? "";
    $<HTMLTextAreaElement>("draft-thesis").readOnly = !!d?.automatic;
    if (document.activeElement !== $("auto-correction"))
      $<HTMLTextAreaElement>("auto-correction").value =
        d?.automatic?.correction ?? "";
    if (d?.automatic?.warning)
      $("draft-status").textContent += " · " + d.automatic.warning;
    const rows = $("evidence-rows"),
      timeline = $("evidence-timeline");
    rows.replaceChildren();
    timeline.replaceChildren();
    const canvas = $<HTMLCanvasElement>("evidence-wave"),
      ctx = canvas.getContext("2d")!,
      signal = api.signal(),
      length = p.audio.clipEnd - p.audio.clipStart;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#416e65";
    if (signal.energy.length)
      for (let x = 0; x < canvas.width; x += 3) {
        const t = p.audio.clipStart + (x / canvas.width) * length,
          v = signal.energy[Math.floor(t / signal.step)] ?? 0;
        ctx.fillRect(x, canvas.height - v * 70, 2, v * 70);
      }
    else {
      ctx.fillStyle = "#657f78";
      ctx.font = "15px sans-serif";
      ctx.fillText("暂无音频能量数据 · 导入音乐后显示", 12, 45);
    }
    if (!d) return;
    const bindingChanged = d.binding !== audioBinding(p);
    d.segments.forEach((s, i) => {
      const button = document.createElement("button");
      button.textContent = `${i + 1} · ${s.start.toFixed(1)}s`;
      button.style.flex = String(s.end - s.start);
      button.title = s.title;
      button.onclick = () => api.seek(s.start);
      button.disabled = bindingChanged;
      timeline.append(button);
      ctx.fillStyle = "#b77848";
      ctx.fillRect((s.start / length) * canvas.width, 0, 1, canvas.height);
      const card = document.createElement("article");
      card.className = "evidence-card";
      card.dataset.segment = String(i);
      const heading = document.createElement("h3");
      heading.textContent = `${String(i + 1).padStart(2, "0")} / ${s.start.toFixed(1)}–${s.end.toFixed(1)} 秒 · ${s.label}`;
      card.append(heading);
      const field = (label: string, node: HTMLElement) => {
        const wrap = document.createElement("label");
        wrap.className = "field";
        const caption = document.createElement("span");
        caption.textContent = label;
        wrap.append(caption, node);
        card.append(wrap);
        return node;
      };
      const start = document.createElement("input");
      start.type = "number";
      start.step = ".1";
      start.value = String(s.start);
      start.disabled = i === 0 || bindingChanged;
      start.setAttribute("aria-label", `段落 ${i + 1} 开始`);
      start.onchange = () => {
        change((d) => {
          const t = Number(start.value);
          d.segments[i].start = t;
          d.segments[i - 1].end = t;
          d.segments[i].locked = true;
          d.segments[i - 1].locked = true;
          for (const s of [d.segments[i], d.segments[i - 1]]) {
            delete s.evidence;
            delete s.interpretation;
          }
        });
        refresh();
      };
      field("开始秒数（片段时间，编辑会锁定相邻段）", start);
      const title = document.createElement("input");
      title.value = s.title;
      title.maxLength = 100;
      title.setAttribute("aria-label", `段落 ${i + 1} 标题`);
      title.onchange = () =>
        change((d) => {
          d.segments[i].title = title.value;
          d.segments[i].locked = true;
        });
      field("段落标题", title);
      const select = (
        label: string,
        key: "intent" | "atmosphere" | "view",
        options: Record<string, string>,
      ) => {
        const node = document.createElement("select");
        node.setAttribute("aria-label", `段落 ${i + 1} ${label}`);
        for (const [value, name] of Object.entries(options))
          node.add(new Option(name, value));
        node.value = s[key];
        node.onchange = () =>
          change((d) => {
            (d.segments[i][key] as string) = node.value;
            d.segments[i].locked = true;
          });
        field(label, node);
      };
      select("叙事意图", "intent", intentions);
      select(
        "氛围",
        "atmosphere",
        Object.fromEntries(p.atmospheres.map((a) => [a.id, a.name])),
      );
      select("机位", "view", viewpoints);
      const note = document.createElement("textarea");
      note.maxLength = 500;
      note.value = s.note;
      note.placeholder = "为什么这里要亮灯、拉远，或保留安静？";
      note.onchange = () =>
        change((d) => {
          d.segments[i].note = note.value;
          d.segments[i].locked = true;
        });
      field("创作判断与理由（人工）", note);
      const lock = document.createElement("input");
      lock.type = "checkbox";
      lock.checked = s.locked;
      lock.setAttribute("aria-label", `段落 ${i + 1} 锁定`);
      lock.onchange = () =>
        change((d) => (d.segments[i].locked = lock.checked));
      field("锁定这段，再生成时保留", lock);
      const evidence = document.createElement("details"),
        summary = document.createElement("summary");
      summary.textContent = "查看原始证据与未知项";
      evidence.append(summary);
      const line = (text: string) => {
        const n = document.createElement("p");
        n.className = "help";
        n.textContent = text;
        evidence.append(n);
      };
      if (bindingChanged)
        line("录音或片段已变化，旧草案暂不展示当前输入的证据，请更新草案。");
      else {
        const f = evidenceFor(p, s, signal);
        line(
          `当前输入的声学事实：平均相对能量 ${f.mean === null ? "未知" : f.mean.toFixed(2)}；起音候选 ${f.onsets} 个（不是节拍）。`,
        );
        line(
          `歌词时间：${p.lyrics.source === "lrc" ? "用户导入 LRC，尚未听校" : p.lyrics.source === "approximate" ? "粗略分配，需校正" : "未提供"}。`,
        );
        for (const l of f.lyrics) {
          const repeat = p.lyrics.lines.filter(
            (x) => x.text.trim() === l.text.trim(),
          ).length;
          line(
            `L${l.id} · ${l.start.toFixed(1)}–${l.end.toFixed(1)}s · ${l.text}${repeat > 1 ? `（相同文本出现 ${repeat} 次，不等于音乐副歌）` : ""}`,
          );
        }
        if (!f.lyrics.length) line("本段没有对齐歌词。");
        const beats = d.structure?.beats.filter(
          (t) =>
            t >= s.start + p.audio.clipStart && t < s.end + p.audio.clipStart,
        );
        line(
          `外部拍点：${beats ? beats.length + " 个，预测待核对" : "未知"}；主旋律未分离。意境来源见本段分析状态。`,
        );
      }
      if (s.interpretation) {
        const meaning = document.createElement("p");
        meaning.className = "evidence-note";
        meaning.textContent = s.interpretation.meaning;
        card.prepend(meaning);
        line("分析依据：" + s.interpretation.rationale);
        if (s.interpretation.weather)
          line(
            `天气：${weatherNames[s.interpretation.weather.kind]} · ${s.interpretation.weather.evidence}（已连接雨雾、地面湿润与光线）`,
          );
        line("不确定之处：" + s.interpretation.uncertainty);
        line(
          "对应歌词：" +
            (s.interpretation.lyricIds.map((id) => "L" + id).join("、") ||
              "无直接歌词证据"),
        );
        if (s.evidence)
          line(
            `音色重心 ${s.evidence.brightnessHz?.toFixed(0) ?? "未知"} Hz；音高分布变化 ${s.evidence.tonalChange?.toFixed(2) ?? "未知"}；混音谱峰走势 ${s.evidence.dominantPitchTrend?.toFixed(1) ?? "未知"} 半音（不等于主旋律）`,
          );
      }
      card.append(evidence);
      rows.append(card);
    });
  }
  return refresh;
}
