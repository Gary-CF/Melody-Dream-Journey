import { el, layers, exportJson } from "./creative-ui";
import {
  componentFeatures,
  featureDescriptions,
} from "./domain/component-features";
import { refKey, type ReviewState } from "./domain/creative-library";
import type { createCreativeRepository } from "./creative-repository";
export function renderCreativeLibrary(
  libraryPanel: HTMLElement,
  repo: ReturnType<typeof createCreativeRepository>,
  setStatus: (text: string) => void,
) {
  let inventoryLibrary;
  try {
    inventoryLibrary = repo.read().library;
  } catch (error) {
    setStatus((error as Error).message);
    return;
  }
  libraryPanel.replaceChildren(
    el("h3", "可复用后台库"),
    el(
      "p",
      "候选内容先作为技术预览；新增场景需要空间缺口与跨歌曲用途。尚未开发的能力不会计作可用资产。",
      "help",
    ),
  );
  const exportButton = el("button", "导出库与复用记录", "secondary");
  exportButton.onclick = () => exportJson(repo.read(), "creative-library.json");
  libraryPanel.append(exportButton);
  const upload = el("input"),
    chooseBackup = el("button", "导入库备份", "secondary"),
    preview = el("p", "", "help"),
    merge = el("button", "合并这份备份", "secondary");
  upload.type = "file";
  upload.accept = ".json,application/json";
  upload.hidden = true;
  upload.id = "creative-library-import";
  merge.id = "creative-library-merge";
  merge.hidden = true;
  let incoming: unknown;
  chooseBackup.onclick = () => upload.click();
  upload.onchange = async () => {
    const file = upload.files?.[0];
    if (!file) return;
    merge.hidden = true;
    incoming = undefined;
    try {
      if (file.size > 8 * 1024 * 1024)
        throw Error("库备份超过 8 MB，请分批归档");
      const data: unknown = JSON.parse(await file.text()),
        result = repo.previewMerge(data);
      incoming = data;
      preview.textContent = `检查完成：新增 ${result.added} 个版本，复用 ${result.reused} 个已有版本。现有配方、来源和审阅状态保持不变。`;
      merge.hidden = false;
    } catch (error) {
      preview.textContent = (error as Error).message;
    } finally {
      upload.value = "";
    }
  };
  merge.onclick = () => {
    if (!incoming) return;
    try {
      const result = repo.merge(incoming);
      renderCreativeLibrary(libraryPanel, repo, setStatus);
      setStatus(
        `库备份已合并，新增 ${result.added} 个版本；再次导入不会重复添加。`,
      );
    } catch (error) {
      preview.textContent = `未合并：${(error as Error).message}`;
    }
  };
  libraryPanel.append(chooseBackup, upload, preview, merge);
  for (const layer of ["scene", "atmosphere", "component"] as const) {
    const list = inventoryLibrary.entries.filter((e) => e.layer === layer),
      section = el("details");
    section.open = layer === "scene";
    section.append(el("summary", `${layers[layer]} · ${list.length} 个版本`));
    const grid = el("div", "", "creative-library-grid");
    for (const item of list) {
      const card = el("article", "", "creative-library-card");
      card.append(
        el("strong", item.name),
        el("p", item.description),
        el(
          "small",
          `${item.origin === "builtin" ? "已有库" : "生成入库"} · ${item.state === "technical-preview" ? "技术预览 / 艺术待审" : item.state === "retired" ? "已退役" : item.origin === "generated" ? "人工审阅通过" : "已有基线"} · ${refKey(item)}`,
        ),
      );
      const details = el("details");
      details.append(
        el("summary", "审视参数与来源"),
        el("pre", JSON.stringify(item, null, 2)),
      );
      card.append(details);
      if (item.layer === "component") {
        const features = componentFeatures(item);
        if (features.length)
          card.append(
            el(
              "p",
              `实际呈现：${features.map((f) => featureDescriptions[f]).join("、")}`,
              "help",
            ),
          );
        const inspect = el("a", "三维审视此版本 ↗");
        inspect.href = `./asset-lab.html?library=${encodeURIComponent(refKey(item))}`;
        inspect.target = "_blank";
        inspect.rel = "noopener";
        card.append(inspect);
      }
      if (item.origin === "generated") {
        const review = el("details"),
          state = el("select"),
          note = el("textarea"),
          save = el("button", "保存审阅", "secondary");
        review.append(el("summary", "审阅此版本"));
        for (const [value, label] of [
          ["technical-preview", "技术预览 / 待审"],
          ["stable", "审阅通过 / 可复用"],
          ["retired", "退役 / 不再推荐"],
        ]) {
          const option = el("option", label);
          option.value = value;
          state.append(option);
        }
        state.value = item.state;
        state.setAttribute("aria-label", "版本审阅状态");
        note.placeholder = "记录画面质量、适用场景或退役原因";
        note.maxLength = 500;
        save.onclick = () => {
          try {
            repo.review(
              { id: item.id, version: item.version },
              state.value as ReviewState,
              note.value,
              new Date().toISOString(),
            );
            renderCreativeLibrary(libraryPanel, repo, setStatus);
            setStatus("审阅已保存；配方与原始来源保留，退役不会删除历史。");
          } catch (error) {
            setStatus((error as Error).message);
          }
        };
        review.append(state, note, save);
        card.append(review);
      }
      grid.append(card);
    }
    section.append(grid);
    libraryPanel.append(section);
  }
}
