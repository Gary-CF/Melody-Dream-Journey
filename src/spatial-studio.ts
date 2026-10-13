import type { PlacementRecord } from "./placement";
import type { SpatialIssue, SpatialProxy, Sweep, Vec3 } from "./domain/spatial";
import type { ViewIssue } from "./domain/camera-clearance";
import type { FramingReport } from "./domain/shot-intent";
import type { Plan } from "./model";
import type { CompiledShot } from "./camera-program";
import type { LayoutRepairReport } from "./layout-repair";

export function installSpatialStudio(api: {
  get: () => {
    time: number;
    records: readonly PlacementRecord[];
    reservations: readonly Sweep[];
    proxies: readonly SpatialProxy[];
    views: { first: ViewIssue[]; overhead: ViewIssue[] };
    framing: { first: FramingReport; overhead: FramingReport };
    automatic: {
      body: ViewIssue[];
      framing: FramingReport;
      heightAdjustment: number;
      eyeAttached: boolean;
      transition: { kind: "cut" | "continuous"; fade: number };
    };
    cameraProgram: { aspect: number; shots: CompiledShot[] };
    composition: LayoutRepairReport;
    heightAdjustment: number;
    lastRejected?: {
      message: string;
      records: readonly PlacementRecord[];
      candidate: Plan;
    };
  };
  overlay: (enabled: boolean, point?: Vec3, proxyId?: string) => void;
  locate: (issue: SpatialIssue) => void;
  seek: (time: number, view?: "first" | "overhead") => void;
}) {
  const panel = document.createElement("aside");
  panel.id = "spatial-panel";
  panel.className = "panel spatial-studio";
  panel.innerHTML = `<button class="close" aria-label="关闭空间检查">×</button><div class="eyebrow">ROUND 03 / SPATIAL REVIEW</div><h2>让每一步，都有路可走</h2><p class="desc">开发检查：通行结果与画面构图分别审阅。</p><div class="spatial-summary" id="spatial-summary"></div><div class="row"><button id="spatial-refresh" class="secondary">检查当前时刻</button><button id="spatial-export" class="secondary">导出检查记录</button></div><label class="field spacer"><span><input id="spatial-overlay" type="checkbox"> 显示连续通行包络</span></label><p class="help">绿色框覆盖观察者身体的整段路线；红色标记定位原候选冲突或当前遮挡。包络为保守边界，不代表真实网格轮廓。</p><h3>摆放调整与未采用构件</h3><div id="spatial-placements"></div><h3>三个镜头模式 · 当前时刻</h3><div id="spatial-views"></div><p class="help">实体净空、实际表面可见率与艺术构图分别检查。精确视线使用静态三角网格；动态物体保留不确定性。样点通过不等于整段或美学通过。</p><div id="spatial-failure"></div>`;
  document.getElementById("app")!.append(panel);
  const programTitle = document.createElement("h3");
  programTitle.textContent = "全程重点镜头 · 编译结果";
  const programList = document.createElement("div");
  programList.id = "spatial-program";
  panel
    .querySelector("#spatial-views")!
    .previousElementSibling!.before(programTitle, programList);
  const layoutTitle = document.createElement("h3");
  layoutTitle.textContent = "场景与机位协同调整";
  const layoutList = document.createElement("div");
  layoutList.id = "spatial-layouts";
  programTitle.before(layoutTitle, layoutList);
  const entry = document.createElement("button");
  entry.id = "open-spatial";
  entry.className = "secondary full";
  entry.textContent = "开发检查 · 通行与双视角";
  document.querySelector("#settings-panel h2")!.after(entry);
  const el = <E extends HTMLElement>(id: string) =>
    panel.querySelector<E>("#" + id)!;
  const text = (tag: string, value: string) => {
    const node = document.createElement(tag);
    node.textContent = value;
    return node;
  };
  const open = () => {
    document
      .querySelectorAll(".panel")
      .forEach((p) => p.classList.remove("open"));
    panel.classList.add("open");
    refresh();
  };
  entry.onclick = open;
  panel.querySelector<HTMLButtonElement>(".close")!.onclick = () => {
    panel.classList.remove("open");
    el<HTMLInputElement>("spatial-overlay").checked = false;
    api.overlay(false);
  };
  el<HTMLButtonElement>("spatial-refresh").onclick = () => refresh();
  el<HTMLInputElement>("spatial-overlay").onchange = () =>
    api.overlay(el<HTMLInputElement>("spatial-overlay").checked);
  const download = (data: unknown, name: string) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  el<HTMLButtonElement>("spatial-export").onclick = () =>
    download({ version: 3, ...api.get() }, "journey-spatial-review.json");
  function refresh() {
    if (!panel.classList.contains("open")) return;
    const data = api.get(),
      adjusted = data.records.filter((r) => r.status !== "accepted");
    layoutList.replaceChildren();
    for (const repair of data.composition.records) {
      const card = document.createElement("article");
      card.className = "sequence-card";
      card.append(
        text("strong", repair.sequenceId),
        text(
          "p",
          repair.status === "repaired"
            ? "横竖屏抽检通过，等待画面审阅"
            : repair.status === "improved-unresolved"
              ? "已有改善，仍存在未满足的构图要求"
              : "保留原布局",
        ),
      );
      card.append(
        text(
          "small",
          `${repair.attempts.length} 个候选 · ${repair.attempts.filter((a) => a.outcome === "route-rejected").length} 个通行冲突 · ${repair.attempts.filter((a) => a.outcome === "presence-regression").length} 个主体尺寸/距离退化；完整记录包含所有候选。`,
        ),
      );
      layoutList.append(card);
    }
    if (!data.composition.records.length)
      layoutList.append(text("p", "当前没有可调整的主体式场景。"));
    el("spatial-summary").textContent =
      `${data.records.length} 个摆放单元 · ${data.reservations.length} 段连续包络 · ${adjusted.filter((r) => r.status === "relocated").length} 组移位 · ${adjusted.filter((r) => r.status === "rejected").length} 项未采用`;
    const list = el("spatial-placements");
    list.replaceChildren();
    if (!adjusted.length)
      list.append(text("p", "全部摆放候选一次通过身体净空检查。"));
    for (const record of adjusted.slice(0, 60)) {
      const card = document.createElement("article");
      card.className = "sequence-card";
      card.append(
        text(
          "strong",
          record.status === "relocated" ? "已重新摆放" : "未采用此构件",
        ),
        text("p", record.id),
      );
      card.append(
        text(
          "small",
          `尝试 ${record.attempts} 次${record.status === "relocated" ? " · 偏移 " + record.displacement.map((v) => v.toFixed(1)).join(" / ") + " 米" : ""}`,
        ),
      );
      const issue = record.issues[0];
      if (issue) {
        const button = text("button", "定位原候选冲突");
        button.onclick = () => {
          el<HTMLInputElement>("spatial-overlay").checked = true;
          api.locate(issue);
          api.overlay(true, issue.point);
          refresh();
        };
        card.append(button);
      }
      list.append(card);
    }
    if (adjusted.length > 60)
      list.append(text("p", "面板显示前 60 项，导出记录包含完整结果。"));
    const views = el("spatial-views");
    programList.replaceChildren();
    if (!data.cameraProgram.shots.length)
      programList.append(
        text("p", "当前没有必需主体式镜头。环境观察与环视仍接受实体检查。"),
      );
    for (const shot of data.cameraProgram.shots) {
      const card = document.createElement("article");
      card.className = "sequence-card";
      card.append(
        text("strong", shot.sequenceId),
        text(
          "small",
          `${shot.checkedTimes[0].toFixed(2)}–${shot.checkedTimes.at(-1)!.toFixed(2)} 秒 · ${shot.checkedTimes.length} 个抽检时刻`,
        ),
      );
      for (const mode of ["overhead", "first"] as const) {
        const choice = shot.selections[mode],
          failure = choice.selected.window?.find(
            (w) => !w.bodyClear || !w.withinBudget || w.status !== "visible",
          );
        const button = text(
          "button",
          `${mode === "first" ? "第一人称" : "俯视"}：${choice.status === "selected" ? "查看揭示中心" : "定位未通过时刻"}`,
        );
        button.dataset.cameraReview = mode;
        button.onclick = () => {
          api.seek(failure?.time ?? shot.at, mode);
          refresh();
        };
        card.append(
          button,
          text(
            "small",
            choice.status === "selected"
              ? "所选候选抽检通过；仍需审阅构图。"
              : `${(choice.selected.passingFraction * 100).toFixed(0)}% 抽检通过；已保留全部尝试与失败证据。`,
          ),
        );
      }
      programList.append(card);
    }
    views.replaceChildren();
    for (const view of ["overhead", "first", "auto"] as const) {
      const issues = view === "auto" ? data.automatic.body : data.views[view],
        body = issues.filter((i) => i.code === "camera-inside-solid");
      const card = document.createElement("article");
      card.className = "sequence-card";
      card.append(
        text(
          "strong",
          `${view === "auto" ? "自动运镜" : view === "first" ? "第一人称" : "俯视"} · ${data.time.toFixed(1)} 秒`,
        ),
        text(
          "p",
          `镜头实体冲突 ${body.length} · 包围盒参考相交 ${issues.length - body.length}${view === "overhead" ? " · 净空抬升 " + data.heightAdjustment.toFixed(1) + " 米" : ""}`,
        ),
      );
      const framing =
        view === "auto" ? data.automatic.framing : data.framing[view];
      const status = {
        context: "环境观察（方向相交不作为失败）",
        visible: "主体可见",
        obstructed: "主体被实体遮挡",
        "out-of-frame": "主体未充分入画",
        underfilled: "主体入画但景别过远",
        unknown: "证据不足或动态遮挡待确认",
      }[framing.status];
      card.append(
        text(
          "p",
          `${status} · ${framing.intent.phase} · ${framing.intent.required ? "必需主体" : "预览/环境"}`,
        ),
      );
      if (framing.samples.length)
        card.append(
          text(
            "small",
            `最弱主体表面样点可见 ${(framing.visibleFraction * 100).toFixed(0)}% · 入画 ${(framing.inFrameFraction * 100).toFixed(0)}% · 动态不确定 ${framing.uncertainSamples}；不是美学评分`,
          ),
        );
      if (framing.missingSubjectIds.length)
        card.append(
          text(
            "p",
            "当前视角没有可用的静态主体几何：" +
              framing.missingSubjectIds.join("、"),
          ),
        );
      for (const subject of framing.composition ?? []) {
        const b = subject.bounds;
        card.append(
          text(
            "small",
            `${subject.role === "primary" ? "主要主体" : "陪衬主体"} · ${subject.subjectId} · ${subject.crop === "contain" ? "完整轮廓" : "表面覆盖"} · ${b ? `${b.clippedPoints}/${b.pointCount} 个轮廓顶点超出安全画框` : "轮廓证据缺失"}`,
          ),
        );
      }
      if (view === "auto")
        card.append(
          text(
            "small",
            `${data.automatic.eyeAttached ? "眼位随观察者" : "自由机位"} · 净空抬升 ${data.automatic.heightAdjustment.toFixed(1)} 米 · ${data.automatic.transition.kind === "cut" ? "短淡黑切换" : "连续过渡"}`,
          ),
        );
      else {
        const shot = data.cameraProgram.shots.find(
          (s) => s.sequenceId === framing.intent.id,
        );
        if (shot) {
          const choice = shot.selections[view];
          card.append(
            text(
              "p",
              `揭示时段抽检：${choice.status === "selected" ? "有合格候选" : choice.fallback === "best-effort" ? "未完全通过，使用较好安全机位" : "未完全通过，保留基础机位"} · 尝试 ${choice.attempts.length} 次`,
            ),
            text(
              "small",
              `${choice.selected.id} · ${shot.checkedTimes.length} 个时间点 · ${(choice.selected.passingFraction * 100).toFixed(0)}% 抽检通过 · 完整候选可导出；不是连续证明或美学评分。`,
            ),
          );
          const failure = choice.selected.window?.find(
            (w) => !w.bodyClear || !w.withinBudget || w.status !== "visible",
          );
          if (failure) {
            const button = text(
              "button",
              `查看未通过时刻 · ${failure.time.toFixed(2)} 秒`,
            );
            button.onclick = () => {
              api.seek(failure.time, view);
              refresh();
            };
            card.append(button);
          }
        }
      }
      for (const sample of framing.samples.filter((s) => s.hit).slice(0, 2)) {
        const button = text("button", `精确视线 · ${sample.hit!.instanceId}`);
        button.onclick = () => {
          el<HTMLInputElement>("spatial-overlay").checked = true;
          api.overlay(true, sample.hit!.point);
        };
        card.append(button);
      }
      for (const issue of issues.slice(0, 4)) {
        const button = text(
          "button",
          `${issue.code === "camera-inside-solid" ? "实体冲突" : "检查遮挡"} · ${issue.instanceId}`,
        );
        button.onclick = () => {
          el<HTMLInputElement>("spatial-overlay").checked = true;
          api.overlay(true, issue.point, issue.proxyId);
        };
        card.append(button);
      }
      views.append(card);
    }
    const failure = el("spatial-failure");
    failure.replaceChildren();
    if (data.lastRejected) {
      failure.append(
        text("h3", "最近候选未应用"),
        text("p", data.lastRejected.message),
        text(
          "p",
          "当前画面保留上一有效版本。导出记录包含完整未应用候选，可继续修正后重新导入；不会丢失本次分析内容。",
        ),
      );
      const exportCandidate = text("button", "导出未应用候选 JSON");
      exportCandidate.className = "secondary full";
      exportCandidate.id = "spatial-export-candidate";
      exportCandidate.onclick = () =>
        download(
          data.lastRejected!.candidate,
          "journey-unapplied-candidate.json",
        );
      failure.append(exportCandidate);
    }
  }
  if (new URLSearchParams(location.search).get("studio") === "spatial") open();
  return refresh;
}
