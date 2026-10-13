import type { KeyValueStore } from "./adapters/scoped-storage";
import { canonical } from "./domain/creative-library";
import { validateLibrary } from "./domain/creative-validation";
import type { CreativeSession } from "./domain/creative-contract";
import { validatePlan, type Plan } from "./model";

const indexKey = "creative-run-index-v1";
const validId = (id: string) => /^[a-zA-Z0-9-]{1,100}$/.test(id);
export interface CreativeHistoryRow {
  runId: string;
  title: string;
  candidates: number;
  responses: number;
  error?: string;
}
/** History owns immutable source/response storage. Library admission is a separate transaction. */
export function createCreativeHistory(store: KeyValueStore) {
  function ids(): string[] {
    const raw = store.getItem(indexKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (
      !Array.isArray(parsed) ||
      parsed.length > 100 ||
      parsed.some((id) => typeof id !== "string" || !validId(id))
    )
      throw Error("创作历史索引损坏；现有记录没有被删除");
    const last = store.getItem("creative-last-run");
    return [...new Set([...(last && validId(last) ? [last] : []), ...parsed])];
  }
  function readRun(runId: string) {
    if (!validId(runId)) throw Error("创作运行标识无效");
    const raw = store.getItem(`creative-run-${runId}`),
      source = store.getItem(`creative-source-${runId}`);
    if (!raw || !source) return undefined;
    const session = JSON.parse(raw) as CreativeSession;
    if (
      session.version !== 1 ||
      !Array.isArray(session.candidates) ||
      !Array.isArray(session.originalResponses)
    )
      throw Error("创作历史损坏，请导出检查");
    if (session.context)
      session.context.library = validateLibrary(session.context.library);
    return { runId, session, source: validatePlan(JSON.parse(source)) };
  }
  return {
    readRun,
    lastRun() {
      const last = store.getItem("creative-last-run");
      return last && validId(last) ? readRun(last) : undefined;
    },
    history(): CreativeHistoryRow[] {
      return ids().map((runId) => {
        try {
          const run = readRun(runId);
          if (!run) throw Error("输入或响应记录不完整");
          return {
            runId,
            title:
              run.source.audio.name ||
              run.session.candidates[0]?.title ||
              "未命名旅程",
            candidates: run.session.candidates.length,
            responses: run.session.originalResponses.length,
          };
        } catch (error) {
          return {
            runId,
            title: "记录暂不可读取",
            candidates: 0,
            responses: 0,
            error: (error as Error).message,
          };
        }
      });
    },
    saveSource(runId: string, source: Plan) {
      if (!validId(runId)) throw Error("创作运行标识无效");
      const key = `creative-source-${runId}`,
        value = JSON.stringify(validatePlan(source));
      if (store.getItem(key) && store.getItem(key) !== value)
        throw Error("首次创作输入不可被替换");
      store.setItem(key, value);
    },
    saveSession(runId: string, session: CreativeSession) {
      if (!validId(runId)) throw Error("创作运行标识无效");
      const key = `creative-run-${runId}`,
        before = store.getItem(key);
      if (before) {
        const old = JSON.parse(before) as CreativeSession;
        if (
          old.contextId !== session.contextId ||
          old.originalResponses.length > session.originalResponses.length ||
          old.originalResponses.some(
            (r, i) => canonical(r) !== canonical(session.originalResponses[i]),
          )
        )
          throw Error("首次自动响应不可被替换");
      }
      const existing = ids();
      if (!existing.includes(runId)) {
        if (existing.length >= 100)
          throw Error(
            "创作历史达到100次容量；请先导出归档，不会自动覆盖旧记录",
          );
        // Index allocation precedes response persistence. Quota failure never destroys an old response.
        store.setItem(indexKey, JSON.stringify([runId, ...existing]));
      }
      store.setItem(key, JSON.stringify(session));
      store.setItem("creative-last-run", runId);
    },
  };
}
