export interface ReviewPlanEntry {
  id: string;
  file: string;
  title: string;
  evidence: string;
  previewTime?: number;
}
/** Replay discovery is data, not a list of song/test branches in the application. */
export async function loadReviewPlan(
  id: string,
  pageUrl: string,
  fetcher: typeof fetch = (...args) => fetch(...args),
) {
  if (!/^[a-z0-9-]{1,80}$/.test(id)) throw Error("回放标识无效");
  const base = new URL("./review-data/", pageUrl);
  const response = await fetcher(new URL("index.json", base));
  if (!response.ok) throw Error("回放目录暂不可用");
  const index = await response.json();
  if (
    index.version !== 1 ||
    !Array.isArray(index.entries) ||
    index.entries.length > 100
  )
    throw Error("回放目录格式无效");
  const entry = index.entries.find((e: ReviewPlanEntry) => e.id === id) as
    | ReviewPlanEntry
    | undefined;
  if (
    !entry ||
    !/^[a-z0-9-]{1,80}\.json$/.test(entry.file) ||
    typeof entry.evidence !== "string" ||
    entry.evidence.length > 500 ||
    (entry.previewTime !== undefined &&
      (!Number.isFinite(entry.previewTime) || entry.previewTime < 0))
  )
    throw Error("没有可用的回放条目");
  const planResponse = await fetcher(new URL(entry.file, base));
  if (!planResponse.ok) throw Error("回放计划暂不可用");
  const source = await planResponse.text();
  if (source.length > 2 * 1024 * 1024) throw Error("回放计划超过2MB");
  return { entry, data: JSON.parse(source) as unknown };
}
