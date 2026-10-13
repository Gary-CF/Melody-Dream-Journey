import type { Plan } from "./model";
import { createCreativeBrief } from "./domain/creative-brief";
import { lyricTime, lyricEnd } from "./domain/plan-time";
import {
  inputKey,
  audioBinding,
  narrativeRevision,
} from "./domain/narrative-contract";
import { builtInCreativeLibrary } from "./domain/creative-catalog";
import type { CreativeLibrary } from "./domain/creative-library";
import type {
  CreativeProvider,
  CreativeSession,
} from "./domain/creative-contract";
import { resolveCreative } from "./domain/creative-resolution";
import { generateCreativeSession } from "./creative-workflow";
import { compileCreativePlan } from "./creative-compiler";
import type { createCreativeRepository } from "./creative-repository";

export interface PreparedCreativeWorld {
  /** Preparation has already validated geometry and both cameras; commit only swaps ownership. */
  commit(): void;
  discard(): void;
}
export interface CreativeState {
  busy: boolean;
  status: string;
  session?: CreativeSession;
  library: CreativeLibrary;
  applied?: string;
  failures: { candidate: string; reason: string }[];
}

/** One owner for automatic/manual creation. Renderer, persistence and model are injected.
 * Old responses can be inspected; only a fresh binding can be compiled or activated. */
export function createCreativeController(deps: {
  current(): Plan;
  prepare(plan: Plan): PreparedCreativeWorld;
  provider: CreativeProvider;
  repository: ReturnType<typeof createCreativeRepository>;
  changed(state: CreativeState): void;
}) {
  let serial = 0,
    abort: AbortController | undefined,
    source: Plan | undefined;
  const state: CreativeState = {
    busy: false,
    status: "导入音乐并完成意境分析后，将自动设计值得驻足的画面。",
    library: builtInCreativeLibrary(),
    failures: [],
  };
  const emit = () => deps.changed(structuredClone(state));
  function isCurrent() {
    const p = deps.current(),
      s = state.session?.source;
    return (
      !!s &&
      !!p.narrative &&
      s.inputKey === inputKey(p) &&
      s.binding === audioBinding(p) &&
      s.revision === narrativeRevision(p.narrative)
    );
  }
  function stop() {
    abort?.abort();
    serial++;
    if (state.busy) state.status = "创作已停止；收到的原始响应已保留。";
    state.busy = false;
    emit();
  }
  function apply(index: number) {
    const session = state.session,
      candidate = session?.candidates[index];
    if (!source || !session || !candidate || !isCurrent())
      throw Error("输入已变化，旧创作只能审阅，请重新生成。");
    const resolution = resolveCreative(
      candidate,
      deps.repository.read().library,
      session.contextId,
      session.context?.allowGrowth ?? source.direction.allowGrowth,
    );
    const compiled = compileCreativePlan(source, resolution, session.source);
    const prepared = deps.prepare(compiled);
    try {
      const used = [
        resolution.scene,
        ...resolution.reused,
        ...resolution.moments.flatMap((m) => [
          m.atmosphere,
          ...m.objects.map((o) => o.ref),
        ]),
      ];
      // Persist only after technical acceptance, before swapping the visible world.
      // Quota or validation failure leaves the current world intact.
      const saved = deps.repository.commit(
        resolution.additions,
        used.map((ref) => ({
          ref,
          source: session.contextId,
          candidate: candidate.id,
        })),
      );
      prepared.commit();
      state.library = saved.library;
    } catch (error) {
      prepared.discard();
      throw error;
    }
    state.applied = candidate.id;
    state.status =
      "已应用逐曲创作；生成内容作为技术预览保存，仍待试听和艺术审阅。";
    emit();
    return resolution.moments[0]?.direction.start ?? 0;
  }
  async function run(
    options: { automatic?: boolean; correction?: string } = {},
  ) {
    abort?.abort();
    const own = ++serial;
    abort = new AbortController();
    const signal = abort.signal;
    // Alternatives compile against one immutable source, never against the previous alternative.
    source = structuredClone(
      !options.automatic && source && isCurrent() ? source : deps.current(),
    );
    state.session = undefined;
    state.applied = undefined;
    state.failures = [];
    state.busy = true;
    state.status = "正在根据全曲证据创作，原始响应将逐份保存…";
    emit();
    const runId = `${Date.now()}-${own}`;
    const tryAutomatic = () => {
      if (
        !options.automatic ||
        state.applied ||
        signal.aborted ||
        own !== serial ||
        !isCurrent()
      )
        return;
      for (
        let index = 0;
        index < (state.session?.candidates.length ?? 0);
        index++
      ) {
        const candidate = state.session!.candidates[index];
        if (state.failures.some((f) => f.candidate === candidate.id)) continue;
        try {
          apply(index);
          return;
        } catch (error) {
          state.failures.push({
            candidate: candidate.id,
            reason: (error as Error).message,
          });
        }
      }
    };
    try {
      state.library = deps.repository.read().library;
      deps.repository.saveSource(runId, source);
      const timedSource = source;
      const brief = createCreativeBrief(source.narrative, {
        inputKey: inputKey(source),
        binding: audioBinding(source),
        lyricTimeline: timedSource.lyrics.lines.map((l, i) => ({
          id: i + 1,
          text: l.text,
          start: lyricTime(l, timedSource),
          end: lyricEnd(l, timedSource),
        })),
      });
      state.session = await generateCreativeSession(
        {
          brief,
          library: state.library,
          allowGrowth: source.direction.allowGrowth,
          correction: options.correction ?? "",
          providerName: "configured-local-provider",
          onProgress(s) {
            if (signal.aborted || own !== serial) return;
            deps.repository.saveSession(runId, s);
            state.session = s;
            state.status = `已收到 ${s.originalResponses.length} 份原始响应，保留 ${s.candidates.length} 份可审阅提案；能力缺口单独列出…`;
            tryAutomatic();
            if (state.applied)
              state.status =
                "已有一个通过场景检查的方向可播放，其他方向继续生成中…";
            emit();
          },
        },
        deps.provider,
        signal,
      );
      if (signal.aborted || own !== serial) return;
      deps.repository.saveSession(runId, state.session);
      state.status = `${state.session.candidates.length} 个创作方向已保存${state.session.generationFailures?.length ? `，${state.session.generationFailures.length} 个方向未通过` : ""}，可查看复用与生长依据。`;
    } catch (error) {
      if (signal.aborted || own !== serial) return;
      state.status = `创作未全部完成：${(error as Error).message}；已收到的候选保留。`;
    } finally {
      if (own === serial) {
        state.busy = false;
        emit();
      }
    }
    if (signal.aborted || own !== serial || !options.automatic || !isCurrent())
      return;
    tryAutomatic();
    if (state.applied) return;
    if (state.session?.candidates.length)
      state.status =
        "候选尚未通过场景验收，已保留原旅程；可在逐曲创作中查看原因。";
    emit();
  }
  function restore(runId?: string) {
    if (state.busy) throw Error("请先停止当前生成，再审阅其他历史记录");
    try {
      const saved = runId
        ? deps.repository.readRun(runId)
        : deps.repository.lastRun();
      if (saved) {
        source = saved.source;
        state.session = saved.session;
        state.library = deps.repository.read().library;
        state.applied = undefined;
        state.failures = [];
        state.status =
          "已打开原始创作记录；输入一致时可应用，应用前会重新核对当前库。";
      }
    } catch (error) {
      state.status = (error as Error).message;
    }
    emit();
  }
  return {
    run,
    stop,
    apply,
    isCurrent,
    restore,
    state: () => structuredClone(state),
  };
}
