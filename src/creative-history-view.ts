import { el, exportJson } from "./creative-ui";
import type { createCreativeRepository } from "./creative-repository";
import type { CreativeHistoryRow } from "./creative-history";

export function renderCreativeHistory(
  root: HTMLElement,
  options: {
    repository: ReturnType<typeof createCreativeRepository>;
    busy: boolean;
    review(runId: string): void;
    status(text: string): void;
  },
) {
  root.replaceChildren(
    el("h3", "过去的逐曲创作"),
    el(
      "p",
      "查看原始提案不会切换音乐。输入一致时可重新应用；精确回放请保留导出的旅程配置。",
      "help",
    ),
  );
  let rows: CreativeHistoryRow[];
  try {
    rows = options.repository.history();
  } catch (error) {
    root.append(el("p", (error as Error).message, "creative-gap"));
    return;
  }
  if (!rows.length) {
    root.append(el("p", "还没有保存的创作。", "help"));
    return;
  }
  const search = el("input");
  search.type = "search";
  search.placeholder = "查找歌名或创作标题";
  search.setAttribute("aria-label", "查找创作历史");
  search.id = "creative-history-search";
  const list = el("div", "", "creative-history-list");
  function render() {
    list.replaceChildren();
    for (const row of rows.filter((r) =>
      r.title.toLowerCase().includes(search.value.toLowerCase()),
    )) {
      const card = el("article", "", "creative-history-card");
      card.dataset.runId = row.runId;
      const timestamp = Number(row.runId.split("-")[0]);
      card.append(
        el("strong", row.title),
        el(
          "p",
          `${row.candidates} 个方向 · ${row.responses} 份原始响应${Number.isFinite(timestamp) && timestamp > 1e12 ? ` · ${new Date(timestamp).toLocaleString()}` : ""}`,
          "help",
        ),
      );
      if (row.error) card.append(el("p", row.error, "creative-gap"));
      else {
        const review = el("button", "审阅这次创作", "secondary"),
          download = el("button", "导出输入与原始响应", "secondary");
        review.disabled = options.busy;
        review.onclick = () => options.review(row.runId);
        download.onclick = () => {
          try {
            const run = options.repository.readRun(row.runId);
            if (!run) throw Error("记录暂不可读取");
            exportJson(
              { version: 1, ...run },
              `creative-history-${row.runId}.json`,
            );
          } catch (error) {
            options.status((error as Error).message);
          }
        };
        card.append(review, download);
      }
      list.append(card);
    }
  }
  search.oninput = render;
  root.append(search, list);
  render();
}
