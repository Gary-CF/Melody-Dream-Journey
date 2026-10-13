import {
  intentions,
  viewpoints,
  type NarrativeDraft,
} from "./domain/narrative-contract";
import {
  createCreativeBrief,
  type CreativeBrief,
  type BriefBinding,
} from "./domain/creative-brief";

const labels = {
  missing: "尚未建立意境分析",
  stale: "输入已经变化 · 仅供查看旧分析",
  semantic: "来自已保存的分段语义分析",
  acoustic: "只有声学预编排 · 尚无歌词语义理解",
  manual: "来自人工或已有章节草案",
};
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const node = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  value: string,
  className?: string,
) => {
  const element = document.createElement(tag);
  element.textContent = value;
  if (className) element.className = className;
  return element;
};

/** Preview-only presenter. It can seek the music clock but has no plan write,
 * model invocation, scene activation or persistence capability. */
export function installBriefStudio(api: {
  get: () => { draft: NarrativeDraft | undefined; current: BriefBinding };
  seek: (time: number) => void;
}) {
  const panel = node("aside", "", "panel brief-studio");
  panel.id = "brief-panel";
  const close = node("button", "×", "close");
  close.setAttribute("aria-label", "关闭创作简报");
  close.onclick = () => panel.classList.remove("open");
  const status = node("p", "", "evidence-note");
  status.id = "brief-status";
  status.setAttribute("role", "status");
  const body = node("div", "");
  body.id = "brief-content";
  const actions = node("div", "", "evidence-actions");
  const refreshButton = node("button", "更新预览", "secondary");
  refreshButton.id = "brief-refresh";
  const exportButton = node("button", "导出创作简报", "secondary");
  exportButton.id = "brief-export";
  const back = node("button", "返回分析与补充", "secondary");
  back.onclick = () => document.getElementById("open-evidence")?.click();
  actions.append(refreshButton, exportButton, back);
  panel.append(
    close,
    node("div", "ROUND 03 / DIRECTOR BRIEF", "eyebrow"),
    node("h2", "先看这段旅程想表达什么"),
    node(
      "p",
      "把音乐与歌词证据、系统解释和你的补充分开审阅，再决定高潮怎样拍。此处只整理已有分析，不改变画面。",
      "desc",
    ),
    status,
    actions,
    body,
  );
  document.getElementById("app")!.append(panel);
  const entry = node("button", "第三轮 · 预览创作简报 ↗", "secondary full");
  entry.id = "open-brief";
  document.querySelector("#evidence-panel h2")!.after(entry);
  const read = () => {
    try {
      const { draft, current } = api.get();
      return createCreativeBrief(draft, current);
    } catch (error) {
      // A review failure cannot interrupt playback or scene activation.
      status.textContent = "分析证据暂时无法关联：" + (error as Error).message;
      status.classList.add("stale");
      exportButton.disabled = true;
      body.replaceChildren(
        node(
          "p",
          "请返回叙事工作台更新分析。当前画面和已有计划保持不变。",
          "help",
        ),
      );
      return undefined;
    }
  };
  const heading = (title: string, text: string) => {
    const card = node("section", "", "brief-block");
    card.append(node("h3", title), node("p", text));
    return card;
  };
  const seekButton = (start: number, brief: CreativeBrief) => {
    const button = node("button", "定位这段 · " + time(start), "secondary");
    button.disabled = brief.status === "stale";
    button.onclick = () => {
      const latest = read();
      if (!latest) return;
      if (
        latest.status === "stale" ||
        latest.source?.inputKey !== brief.source?.inputKey ||
        latest.source?.draftRevision !== brief.source?.draftRevision
      )
        return refresh();
      api.seek(start);
    };
    return button;
  };
  function refresh() {
    const brief = read();
    if (!brief) return;
    status.textContent = labels[brief.status];
    status.classList.toggle("stale", brief.status === "stale");
    exportButton.disabled = brief.status === "missing";
    body.replaceChildren();
    if (brief.status === "missing") {
      body.append(
        heading(
          "先有依据，再谈镜头",
          "请在叙事工作台导入音乐与歌词并完成分析。人工预览场景不带歌曲语义，不能据此推断一首歌的故事。",
        ),
      );
      return;
    }
    if (brief.status === "stale")
      body.append(
        heading(
          "旧分析需要重新关联",
          "歌词、音乐片段或意境输入已变化。下面保留旧理解供比较，暂停重点时段建议和定位；请先返回工作台更新分析。",
        ),
      );
    if (brief.source?.notice)
      body.append(node("p", brief.source.notice, "help"));
    body.append(
      heading("整段的情绪走向", brief.thesis.effective || "尚未提供整体解释。"),
    );
    if (brief.thesis.baseline !== null) {
      const baseline = node("details", "");
      baseline.append(
        node("summary", "查看原始自动理解"),
        node("p", brief.thesis.baseline),
      );
      body.append(baseline);
    }
    body.append(
      heading(
        "保存的补充请求",
        brief.thesis.correction ||
          "没有额外文字补充。系统理解仍应以歌词与音乐为依据。",
      ),
    );
    if (brief.thesis.correction)
      body.append(
        node(
          "p",
          "补充文字是人的意图；请对照原始与当前解释判断是否体现，不自动视为已经执行的场景。",
          "help",
        ),
      );
    body.append(
      node("h3", "可继续创作的重点时段"),
      node(
        "p",
        "以下来自已有语义建议；没有用音量排名。最多标出两个优先审阅的时段，尚未创作电影镜头。",
        "help",
      ),
    );
    if (!brief.opportunities.length)
      body.append(
        node(
          "p",
          brief.status === "acoustic"
            ? "声学特征可以辅助分段，但不能代替歌词语义。需要语义分析后再讨论故事与高潮。"
            : "现有分析未给出重点时段线索，暂不强行指定高潮。",
          "evidence-note",
        ),
      );
    for (const opportunity of brief.opportunities) {
      const card = node("article", "", "brief-block brief-opportunity");
      card.dataset.opportunity = opportunity.id;
      const suggested = brief.suggestedIds.includes(opportunity.id);
      card.append(
        node(
          "small",
          `${time(opportunity.start)}–${time(opportunity.end)} · ${opportunity.locked ? "人工锁定，保留决定" : suggested ? "优先审阅" : "创作线索"}`,
        ),
        node("h3", opportunity.arc.arrival),
        node("p", "为什么值得停留：" + opportunity.reason),
        node(
          "p",
          "铺垫：" + (opportunity.arc.before ?? "这是开篇时段，没有前段语义。"),
        ),
        node(
          "p",
          "余韵：" + (opportunity.arc.after ?? "这是结尾时段，没有后段语义。"),
        ),
        node(
          "p",
          "仍需判断：" +
            (opportunity.uncertainty ||
              "模型未说明不确定性；这不等于已获验证。"),
          "help",
        ),
        node(
          "small",
          "对应歌词：" +
            (opportunity.citedLyricIds.map((id) => `L${id}`).join("、") ||
              "没有直接歌词引用"),
        ),
      );
      card.append(seekButton(opportunity.start, brief));
      if (opportunity.legacyHint) {
        const detail = node("details", "");
        detail.append(
          node("summary", "已有渲染建议（尚非创作方案）"),
          node(
            "p",
            `旧分析提出 ${opportunity.legacyHint.kind} / ${opportunity.legacyHint.focus}。它只说明现有模板建议，不限制后续设计，也不证明场景契合歌曲。`,
          ),
        );
        card.append(detail);
      }
      body.append(card);
    }
    body.append(node("h3", "逐段核对依据"));
    for (const beat of brief.beats) {
      const details = node("details", "", "brief-beat");
      details.dataset.beat = beat.id;
      details.append(
        node(
          "summary",
          `${time(beat.start)}–${time(beat.end)} · ${beat.title}`,
        ),
      );
      details.append(
        node(
          "p",
          `当前编排：${intentions[beat.direction.intent]} · ${viewpoints[beat.direction.view]} · ${beat.direction.atmosphere}${beat.direction.locked ? " · 人工锁定" : ""}`,
        ),
      );
      if (beat.direction.note)
        details.append(node("p", "段落备注：" + beat.direction.note));
      if (beat.interpretation)
        details.append(
          node(
            "h4",
            brief.status === "acoustic" ? "声学规则预编排" : "保存的段落解释",
          ),
          node("p", beat.interpretation.meaning),
          node("p", beat.interpretation.rationale),
          node(
            "p",
            "不确定性：" + (beat.interpretation.uncertainty || "未说明"),
            "help",
          ),
        );
      const evidence = beat.evidence;
      details.append(node("h4", "歌词与音乐事实"));
      if (!evidence)
        details.append(
          node("p", "这一段没有关联的声学或歌词证据；章节设置不等于音乐分析。"),
        );
      else {
        details.append(
          node(
            "p",
            evidence.lyrics.length
              ? evidence.lyrics.map((l) => `L${l.id} · ${l.text}`).join("\n")
              : "没有该时段的歌词文本。",
            "brief-lyrics",
          ),
        );
        details.append(
          node(
            "p",
            `能量 ${evidence.energy?.toFixed(2) ?? "未知"}；变化 ${evidence.energyTrend?.toFixed(2) ?? "未知"}；起音密度 ${evidence.onsetsPerSecond.toFixed(2)} / 秒。`,
            "help",
          ),
        );
        details.append(
          node(
            "p",
            `音色重心 ${evidence.brightnessHz?.toFixed(0) ?? "未知"} Hz；混音谱峰走势 ${evidence.dominantPitchTrend?.toFixed(1) ?? "未知"} 半音。混音谱峰不是可靠的主旋律或和声分析。`,
            "help",
          ),
        );
        details.append(
          node(
            "p",
            "语义引用：" +
              (beat.citedLyrics.map((l) => `L${l.id}`).join("、") ||
                "没有直接引用"),
            "help",
          ),
        );
      }
      if (
        beat.baselineInterpretation &&
        JSON.stringify(beat.baselineInterpretation) !==
          JSON.stringify(beat.interpretation)
      ) {
        details.append(
          node("h4", "修正前的自动解释"),
          node("p", beat.baselineInterpretation.meaning),
        );
      }
      details.append(seekButton(beat.start, brief));
      body.append(details);
    }
    body.append(
      heading(
        "下一步还缺什么",
        "独立的构图候选、构件能力匹配与扩充、场景和空间编译，以及真实音乐试听与艺术审阅。这份简报只是这些环节的输入，不会自动宣布它们已完成。",
      ),
    );
  }
  exportButton.onclick = () => {
    const brief = read();
    if (!brief) return;
    if (brief.status === "missing") return refresh();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" }),
    );
    const a = node("a", "");
    a.href = url;
    a.download = "journey-director-brief.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    refresh();
  };
  refreshButton.onclick = refresh;
  entry.onclick = () => {
    document
      .querySelectorAll(".panel")
      .forEach((p) => p.classList.toggle("open", p === panel));
    refresh();
  };
  if (new URLSearchParams(location.search).get("studio") === "brief")
    entry.click();
  return () => {
    if (panel.classList.contains("open")) refresh();
  };
}
