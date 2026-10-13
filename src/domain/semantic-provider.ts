import type { SemanticResult, WindowEvidence } from "./semantic-contract";
import type { intentions, viewpoints } from "./narrative-vocabulary";
import type { Theme } from "../model";

/** Portable analysis input, independent of HTTP, Ollama or UI state. */
export interface SemanticContext {
  version: 1;
  protocolVersion: 3;
  windows: WindowEvidence[];
  lyricTiming: "none" | "lrc" | "approximate";
  lyricTimeline: { id: number; start: number; end: number; text: string }[];
  limitations: string[];
  atmospheres: { id: string; name: string }[];
  themes: string[];
  intents: string[];
  views: string[];
  assets: { id: string; tags: string[]; name: string }[];
  weatherKinds?: string[];
  sequenceKinds?: string[];
  availableSequenceDescriptions: {
    id: string;
    requires: string[];
    description: string;
  }[];
  sequenceGuide: string;
  viewGuide?: Record<keyof typeof viewpoints, string>;
  themeGuide?: Record<Theme, string>;
}

export type SemanticRequest = SemanticContext &
  (
    | { task: "boundaries" }
    | { task: "interpret"; correction: string; baseline?: SemanticResult }
    | {
        task: "direction";
        thesis: string;
        interpretations: {
          id: number;
          meaning: string;
          intent: keyof typeof intentions;
        }[];
      }
  );

/** Responses stay unknown until application/domain validators accept them. */
export interface SemanticProvider {
  analyze(request: SemanticRequest, signal: AbortSignal): Promise<unknown>;
}
