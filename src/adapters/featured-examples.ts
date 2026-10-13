import { duration, validatePlan, type Plan } from "../model";
import type { KeyValueStore } from "./scoped-storage";

export const exampleRenderer = "0.1.0-rc.1 / bbf8567";
const storageKey = "melodic-journey:examples:v1";
export interface SavedExample {
  format: "melodic-journey-example";
  version: 1;
  id: string;
  title: string;
  createdAt: string;
  source: { renderer: string; note: string; parent?: string };
  highlights: { title: string; time: number }[];
  plan: Plan;
}
export interface FeaturedEntry {
  id: string;
  file: string;
  cover: string;
}

export function validateExample(value: unknown): SavedExample {
  const e = structuredClone(value) as SavedExample;
  const short = (v: unknown, max: number): v is string =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max;
  if (
    !e ||
    e.format !== "melodic-journey-example" ||
    e.version !== 1 ||
    !short(e.id, 80) ||
    !/^[a-z0-9-]+$/.test(e.id) ||
    !short(e.title, 80) ||
    !short(e.createdAt, 40) ||
    !Number.isFinite(Date.parse(e.createdAt)) ||
    !short(e.source?.renderer, 160) ||
    !short(e.source?.note, 500) ||
    (e.source.parent !== undefined && !short(e.source.parent, 160)) ||
    !Array.isArray(e.highlights) ||
    e.highlights.length > 8
  )
    throw Error("示例文件格式无效（需要版本 1 的示例包）");
  const checked = validatePlan(e.plan);
  for (const h of e.highlights)
    if (
      !short(h?.title, 80) ||
      !Number.isFinite(h.time) ||
      h.time < 0 ||
      h.time > duration(checked)
    )
      throw Error("示例亮点时间超出旅程范围");
  // Validate a clone, retaining the original serialized plan and embedded library.
  if (JSON.stringify(e).length > 2 * 1024 * 1024)
    throw Error("示例包不能超过 2MB");
  return e;
}

export function readExamples(store: KeyValueStore): SavedExample[] {
  const raw = store.getItem(storageKey);
  if (!raw) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries) || entries.length > 20)
    throw Error("本机示例库不可读；原数据已保留");
  return entries.map(validateExample);
}

export function saveExample(
  store: KeyValueStore,
  value: unknown,
): SavedExample {
  const entry = validateExample(value);
  const entries = readExamples(store);
  if (entries.some((e) => e.id === entry.id))
    throw Error("此版本已保存；请创建新副本");
  if (entries.length >= 20)
    throw Error("本机已保存 20 个版本，请先导出备份后删除旧版本");
  store.setItem(storageKey, JSON.stringify([entry, ...entries]));
  return entry;
}

export function removeExample(store: KeyValueStore, id: string) {
  store.setItem(
    storageKey,
    JSON.stringify(readExamples(store).filter((e) => e.id !== id)),
  );
}

export async function loadFeatured(
  pageUrl: string,
): Promise<{ entry: FeaturedEntry; example: SavedExample }[]> {
  const base = new URL("./featured/", pageUrl);
  const response = await fetch(new URL("index.json", base));
  if (!response.ok) throw Error("精选示例目录暂不可用");
  const index = await response.json();
  if (
    index.version !== 1 ||
    !Array.isArray(index.entries) ||
    index.entries.length > 20
  )
    throw Error("精选目录格式无效");
  return Promise.all(
    index.entries.map(async (entry: FeaturedEntry) => {
      if (
        !/^[a-z0-9-]{1,80}$/.test(entry.id) ||
        !/^[a-z0-9-]{1,80}\.json$/.test(entry.file) ||
        !/^[a-z0-9-]{1,80}\.jpg$/.test(entry.cover)
      )
        throw Error("精选目录路径无效");
      const result = await fetch(new URL(entry.file, base));
      if (!result.ok) throw Error("精选示例暂不可用");
      const text = await result.text();
      if (text.length > 2 * 1024 * 1024) throw Error("示例包不能超过 2MB");
      const example = validateExample(JSON.parse(text));
      if (example.id !== entry.id) throw Error("精选示例标识不一致");
      return { entry, example };
    }),
  );
}
