import type { SemanticProvider } from "../domain/semantic-provider";

/** Same-origin transport. Provider selection never changes domain contracts. */
export function createHttpSemanticProvider(
  endpoint = "/api/narrative/analyze",
  fetcher: typeof fetch = (...args) => fetch(...args),
): SemanticProvider {
  return {
    async analyze(request, signal) {
      signal.throwIfAborted();
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify(request, (_key, value) =>
          typeof value === "number" ? Math.round(value * 1000) / 1000 : value,
        ),
      });
      if (!response.ok) {
        const error: unknown = await response.json().catch(() => null);
        const message =
          error &&
          typeof error === "object" &&
          "error" in error &&
          typeof error.error === "string"
            ? error.error
            : `模型服务不可用 (${response.status})`;
        throw Error(message);
      }
      const result: unknown = await response.json();
      signal.throwIfAborted();
      return result;
    },
  };
}

export const localSemanticProvider = createHttpSemanticProvider();
