import {
  contentId,
  journeyStyle,
  type CreativeLibrary,
} from "./domain/creative-library";
import {
  validateCreativeCandidate,
  type CreativeContext,
  type CreativeProvider,
  type CreativeSession,
} from "./domain/creative-contract";
import type { CreativeBrief } from "./domain/creative-brief";
import { resolveCreative } from "./domain/creative-resolution";

export interface CreativeGenerationOptions {
  brief: CreativeBrief;
  library: CreativeLibrary;
  allowGrowth: boolean;
  correction?: string;
  providerName: string;
  onProgress?: (session: CreativeSession) => void;
}
/** Application orchestration is transport/storage/UI independent. Partial first responses
 * remain reviewable; cancellation cannot mutate an accepted session or world. */
export async function generateCreativeSession(
  options: CreativeGenerationOptions,
  provider: CreativeProvider,
  signal: AbortSignal,
): Promise<CreativeSession> {
  const { onProgress, ...data } = options;
  const source = structuredClone(data);
  // Callbacks stay outside the immutable data snapshot.
  return generate(source, provider, signal, onProgress);
}
async function generate(
  options: CreativeGenerationOptions,
  provider: CreativeProvider,
  signal: AbortSignal,
  onProgress?: CreativeGenerationOptions["onProgress"],
) {
  const { brief, library, allowGrowth } = options;
  if (!brief.source || brief.status === "missing" || brief.status === "stale")
    throw Error("需要与当前输入关联的分段分析，才能进行逐曲创作");
  if ((options.correction?.length ?? 0) > 500)
    throw Error("补充文字请限制在500字以内");
  const session: CreativeSession = {
    version: 1,
    source: {
      inputKey: brief.source.inputKey,
      binding: brief.source.binding,
      revision: brief.source.draftRevision,
    },
    contextId: contentId({ brief, library, style: journeyStyle }),
    correction: options.correction ?? "",
    candidates: [],
    originalResponses: [],
    generationFailures: [],
    provider: options.providerName,
    context: structuredClone({
      directorVersion: 2,
      brief,
      library,
      style: journeyStyle,
      allowGrowth,
    }),
  };
  for (let ordinal = 1; ordinal <= 3; ordinal++) {
    signal.throwIfAborted();
    const context: CreativeContext = {
      directorVersion: 2,
      version: 1,
      task: "creative",
      brief,
      library,
      style: journeyStyle,
      allowGrowth,
      ordinal,
      previous: session.candidates.map(
        ({ title, thesis, difference, moments }) => ({
          title,
          thesis,
          difference,
          moments: moments.map((m) => ({
            beatId: m.beatId,
            metaphor: m.metaphor,
            story: m.story,
            technique: m.score?.technique,
            stages: m.score?.stages.map((s) => s.purpose),
            subject:
              m.objects.find((o) => o.role === "primary")?.content.reuse?.id ??
              m.objects.find((o) => o.role === "primary")?.content.create
                ?.name ??
              m.commitments?.[0].description ??
              "尚未实现的主体",
          })),
        }),
      ),
      correction: session.correction,
    };
    let candidate: ReturnType<typeof validateCreativeCandidate> | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = structuredClone(
        await provider.create(structuredClone(context), signal),
      );
      signal.throwIfAborted();
      session.originalResponses.push({
        ordinal,
        attempt: attempt + 1,
        response: raw,
      });
      // A bounded repair never replaces the first response in the evidence archive.
      onProgress?.(structuredClone(session));
      let repairScope: "intent" | "production" = "production";
      try {
        const validated = validateCreativeCandidate(raw, context);
        const resolved = resolveCreative(
          validated,
          library,
          session.contextId,
          allowGrowth,
        );
        const acknowledgedGap = validated.moments.some((m) =>
          m.commitments?.some(
            (c) =>
              c.essential &&
              m.bindings?.some(
                (b) => b.claimId === c.id && b.target === "unresolved",
              ),
          ),
        );
        if (resolved.status === "blocked" && !acknowledgedGap) {
          repairScope = resolved.repairScope ?? "production";
          throw Error(`创作存在能力缺口：${resolved.gaps.join("；")}`);
        }
        candidate = validated;
        break;
      } catch (error) {
        if (attempt === 1) {
          session.generationFailures!.push({
            ordinal,
            reason: (error as Error).message,
          });
          onProgress?.(structuredClone(session));
          break;
        }
        context.repair = {
          previous: raw,
          error: (error as Error).message,
          scope: repairScope,
        };
      }
    }
    if (!candidate) continue;
    if (
      session.candidates.some(
        (c) =>
          contentId({ world: c.world, moments: c.moments }) ===
          contentId({ world: candidate.world, moments: candidate.moments }),
      )
    ) {
      session.generationFailures!.push({
        ordinal,
        reason: "模型重复了已有候选，原始结果已保留；没有把重复内容计作新创作",
      });
      onProgress?.(structuredClone(session));
      continue;
    }
    session.candidates.push(candidate);
    onProgress?.(structuredClone(session));
  }
  if (!session.candidates.length)
    throw Error("所有创作方向均未通过校验；原始输出和逐项原因已保留");
  return structuredClone(session);
}
