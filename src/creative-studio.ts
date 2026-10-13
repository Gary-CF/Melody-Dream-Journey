import { el, layers, exportJson } from "./creative-ui";
import { renderCreativeLibrary } from "./creative-library-view";
import { renderCreativeHistory } from "./creative-history-view";
import { featureDescriptions } from "./domain/component-features";
import { phaseNames } from "./domain/cinematic-score";
import { getModelStatus } from "./adapters/model-status";
import type { Plan } from "./model";
import { builtInCreativeLibrary } from "./domain/creative-catalog";
import {
  resolveEntry,
  refKey,
  type ReviewState,
} from "./domain/creative-library";
import {
  resolveCreative,
  type CreativeResolution,
} from "./domain/creative-resolution";
import type { CreativeSession } from "./domain/creative-contract";
import {
  createCreativeController,
  type PreparedCreativeWorld,
} from "./creative-controller";
import { createHttpCreativeProvider } from "./adapters/http-creative-provider";
import { createBrowserStorage } from "./adapters/scoped-storage";
import { createCreativeRepository } from "./creative-repository";
import "./creative-studio.css";

const stamp = (n: number) =>
  `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, "0")}`;
export function installCreativeStudio(api: {
  get: () => Plan;
  prepare: (plan: Plan) => PreparedCreativeWorld;
  status?: (text: string) => void;
  seek: (time: number) => void;
  toast: (text: string) => void;
}) {
  const repo = createCreativeRepository(createBrowserStorage());
  let library = builtInCreativeLibrary(),
    session: CreativeSession | undefined,
    resolutions: CreativeResolution[] = [];
  const panel = el("aside", "", "panel creative-studio");
  panel.id = "creative-panel";
  const close = el("button", "×", "close");
  close.setAttribute("aria-label", "关闭逐曲创作");
  close.onclick = () => panel.classList.remove("open");
  const status = el(
    "p",
    "先完成意境分析，再为这首歌设计值得驻足的画面。",
    "creative-status",
  );
  status.id = "creative-status";
  status.setAttribute("role", "status");
  const title = el("h2", "为这首歌，留下一幅画面");
  const modelStatus = el("p", "正在检查本地创作能力…", "help");
  modelStatus.id = "creative-model-status";
  void getModelStatus()
    .then((s) => {
      const model = s.creative ?? s;
      modelStatus.textContent = model.configured
        ? `逐曲创作：${model.model} · ${model.detail ?? "已配置"}`
        : "逐曲创作模型尚未配置";
    })
    .catch(() => {
      modelStatus.textContent = "模型状态暂不可用；已有创作记录仍可审阅。";
    });
  const subtitle = el(
    "p",
    "场景优先复用 · 氛围与组件按需生长 · 原始提案保留，应用时再次核对当前库",
    "desc",
  );
  const correction = el("textarea");
  correction.id = "creative-correction";
  correction.maxLength = 500;
  correction.placeholder =
    "可选：只补充歌词与音乐之外的意图，例如结尾想保留一点温暖。";
  const correctionLabel = el("label", "补充创作方向（可留空）", "field");
  correctionLabel.append(correction);
  const actions = el("div", "", "creative-actions"),
    generate = el("button", "生成候选画面", "primary"),
    cancel = el("button", "停止生成", "secondary"),
    download = el("button", "导出原始创作", "secondary"),
    inventory = el("button", "查看三层后台库", "secondary"),
    history = el("button", "创作历史", "secondary");
  generate.id = "creative-generate";
  cancel.id = "creative-cancel";
  download.id = "creative-export";
  inventory.id = "creative-library-toggle";
  history.id = "creative-history-toggle";
  cancel.disabled = true;
  download.disabled = true;
  const body = el("div", "", "creative-candidates");
  body.id = "creative-candidates";
  const libraryPanel = el("section", "", "creative-inventory");
  libraryPanel.id = "creative-library";
  libraryPanel.hidden = true;
  const historyPanel = el("section", "", "creative-inventory");
  historyPanel.id = "creative-history";
  historyPanel.hidden = true;
  actions.append(generate, cancel, download, inventory, history);
  panel.append(
    close,
    el("div", "ROUND 03 / SONG DIRECTION", "eyebrow"),
    title,
    subtitle,
    modelStatus,
    status,
    correctionLabel,
    actions,
    body,
    libraryPanel,
    historyPanel,
  );
  document.getElementById("app")!.append(panel);
  const entry = el("button", "逐曲创作与生长 ↗", "secondary full");
  entry.id = "open-creative";
  document.querySelector("#evidence-panel h2")!.after(entry);
  entry.onclick = () => {
    panel.classList.add("open");
    renderLibrary();
  };
  const briefEntry = el("button", "开始逐曲创作 ↗", "secondary");
  briefEntry.onclick = entry.onclick;
  document.querySelector("#brief-panel .evidence-actions")?.append(briefEntry);
  function renderLibrary() {
    renderCreativeLibrary(libraryPanel, repo, (text) => {
      status.textContent = text;
    });
  }
  function current() {
    return controller.isCurrent();
  }
  function renderHistory(busy = controller.state().busy) {
    renderCreativeHistory(historyPanel, {
      repository: repo,
      busy,
      review(runId) {
        controller.restore(runId);
        historyPanel.hidden = true;
      },
      status(text) {
        status.textContent = text;
      },
    });
  }
  function render() {
    body.replaceChildren();
    resolutions = [];
    download.disabled = !session;
    for (const [index, candidate] of (session?.candidates ?? []).entries()) {
      const card = el("article", "", "creative-direction");
      card.dataset.candidate = String(index);
      card.append(
        el("span", `方向 ${index + 1}`, "creative-index"),
        el("h3", candidate.title),
        el("p", candidate.thesis),
        el("p", candidate.difference, "help"),
      );
      if (candidate.reviewNotes?.length) {
        const review = el("details");
        review.append(
          el(
            "summary",
            `模型核对提示 · ${candidate.reviewNotes.length} 项，可能有误报`,
          ),
        );
        for (const note of candidate.reviewNotes) review.append(el("p", note));
        card.append(review);
      }
      try {
        const r = resolveCreative(
          candidate,
          library,
          session!.contextId,
          session?.context?.allowGrowth ?? api.get().direction.allowGrowth,
        );
        resolutions.push(r);
        card.append(
          el("h4", `场景 · ${resolveEntry(r.library, r.scene).name}`),
          el("p", candidate.world.reason),
          el("p", r.sceneDecision.growth.reason, "help"),
        );
        const reasoning = el("details");
        reasoning.append(el("summary", "为什么复用 / 为什么生长"));
        for (const rank of r.sceneDecision.ranking)
          reasoning.append(
            el(
              "p",
              `${rank.name}：空间覆盖 ${(rank.fit * 100).toFixed(0)}%${rank.missing.length ? `；缺少 ${rank.missing.map((x) => x.value).join("、")}` : ""}${rank.conflicts?.length ? `；${rank.identityConflict ? "核心空间冲突" : "本次可移除的装饰"}：${rank.conflicts.map((f) => featureDescriptions[f]).join("、")}` : ""}`,
            ),
          );
        reasoning.append(el("p", "覆盖率是输入要素匹配程度，不是艺术质量分。"));
        card.append(reasoning);
        for (const moment of r.moments) {
          const m = moment.direction,
            section = el("section", "", "creative-moment");
          section.append(
            el("h4", `${stamp(m.start)}–${stamp(m.end)} · ${m.title}`),
            el("p", m.story),
            el("p", m.metaphor),
            el("p", `铺垫：${m.approach}`),
            el("p", `余韵：${m.aftermath}`),
            el("p", `氛围：${resolveEntry(r.library, moment.atmosphere).name}`),
            el(
              "p",
              `主体：${moment.objects.map((o) => resolveEntry(r.library, o.ref).name).join(" / ") || "尚无可执行载体，保留导演意图"}`,
            ),
          );
          if (m.entityId) {
            const first = r.moments.find(
              (other) => other.direction.entityId === m.entityId,
            )!;
            section.append(
              el(
                "p",
                first === moment
                  ? "地标身份：一处独立实体。"
                  : `继续观察「${first.direction.title}」中的同一处地标，主体不会重新建造。`,
                "help",
              ),
            );
          }
          if (m.score) {
            const sequence = el("ol", "", "creative-score");
            for (const stage of m.score.stages) {
              const item = el("li");
              item.append(
                el(
                  "strong",
                  `${stamp(m.start + stage.start)}–${stamp(m.start + stage.end)} · ${phaseNames[stage.phase]}`,
                ),
                el("p", stage.purpose),
              );
              const watch = el("button", "观看此阶段", "secondary");
              watch.onclick = () => {
                if (api.get().creativeWorld?.candidate !== candidate.id) {
                  status.textContent = "请先预览这份创作，再观看其阶段。";
                  return;
                }
                api.seek(m.start + stage.start);
                panel.classList.remove("open");
              };
              item.append(watch);
              sequence.append(item);
            }
            section.append(sequence);
          }
          if (m.commitments) {
            const commitments = el("details");
            commitments.append(el("summary", "必要画面与实现情况"));
            for (const claim of m.commitments) {
              const binding = m.bindings?.find((b) => b.claimId === claim.id);
              const actual =
                binding?.target === "component" &&
                moment.objects[binding.objectIndex]
                  ? resolveEntry(
                      r.library,
                      moment.objects[binding.objectIndex].ref,
                    ).name
                  : binding?.target === "observer"
                    ? "观察者动作轨道"
                    : binding?.target === "lighting"
                      ? "光影渐变轨道"
                      : "尚未实现";
              const supportedMeaning =
                featureDescriptions[
                  claim.capability as keyof typeof featureDescriptions
                ] ??
                (
                  {
                    walk: "沿路行走",
                    pause: "驻足",
                    look: "转头与凝望",
                    "enter-exit": "沿已验证通道出入",
                    "lighting-transition": "环境光色渐变",
                  } as Record<string, string>
                )[claim.capability] ??
                `未支持的能力：${claim.capability}`;
              commitments.append(
                el(
                  "p",
                  `${claim.description}${claim.representation === "metaphor" ? "（艺术转译）" : ""}。执行载体：${actual}；登记能力：${supportedMeaning}。细节与情绪表达仍需对照回放。`,
                ),
              );
            }
            section.append(commitments);
          }
          const evidence = el("details");
          evidence.append(
            el("summary", "依据、视角与不确定性"),
            el("p", m.evidence),
            el("p", m.uncertainty || "模型未补充不确定性；仍需试听审阅。"),
            el("p", `第一视角：${m.views.first}`),
            el("p", `俯视：${m.views.overhead}`),
          );
          section.append(evidence);
          card.append(section);
        }
        card.append(
          el(
            "p",
            `本方案新增 ${r.additions.length} 项：${r.additions.map((e) => `${layers[e.layer]} / ${e.name}`).join("；") || "全部复用"}`,
            "creative-growth",
          ),
        );
        for (const notice of r.notices) card.append(el("p", notice, "help"));
        for (const gap of r.gaps)
          card.append(el("p", `待解决：${gap}`, "creative-gap"));
        const apply = el("button", "预览这份创作", "primary");
        apply.disabled = r.status !== "ready" || !current();
        apply.onclick = () => {
          if (!current()) {
            status.textContent = "输入已经变化，旧创作只供审阅，请重新生成。";
            render();
            return;
          }
          try {
            const time = controller.apply(index);
            panel.classList.remove("open");
            api.seek(time);
            renderLibrary();
          } catch (error) {
            status.textContent = (error as Error).message;
          }
        };
        card.append(apply);
      } catch (error) {
        card.append(
          el(
            "p",
            `候选尚不可执行：${(error as Error).message}`,
            "creative-gap",
          ),
        );
      }
      body.append(card);
    }
  }
  const controller = createCreativeController({
    current: api.get,
    prepare: api.prepare,
    provider: createHttpCreativeProvider(),
    repository: repo,
    changed(state) {
      session = state.session;
      library = state.library;
      status.textContent = state.status;
      generate.disabled = state.busy;
      cancel.disabled = !state.busy;
      if (!historyPanel.hidden) renderHistory(state.busy);
      api.status?.(state.status);
      render();
      for (const failure of state.failures)
        body.append(el("p", failure.reason, "creative-gap"));
      for (const failure of state.session?.generationFailures ?? [])
        body.append(
          el(
            "p",
            `方向 ${failure.ordinal} 未通过：${failure.reason}`,
            "creative-gap",
          ),
        );
    },
  });
  controller.restore();
  generate.onclick = () =>
    void controller.run({ correction: correction.value });
  cancel.onclick = () => controller.stop();
  download.onclick = () =>
    session && exportJson(session, "song-direction-original.json");
  inventory.onclick = () => {
    libraryPanel.hidden = !libraryPanel.hidden;
    renderLibrary();
  };
  history.onclick = () => {
    historyPanel.hidden = !historyPanel.hidden;
    renderHistory();
  };
  return {
    refresh: () => {
      if (panel.classList.contains("open")) render();
    },
    generate: () => controller.run({ automatic: true }),
    cancel: controller.stop,
    open: () => entry.click(),
  };
}
