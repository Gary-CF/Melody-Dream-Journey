import type { CreativeProvider } from "../domain/creative-contract";

export function createHttpCreativeProvider(
  endpoint = "/api/narrative/analyze",
  fetcher: typeof fetch = (...args) => fetch(...args),
): CreativeProvider {
  return {
    async create(context, signal) {
      signal.throwIfAborted();
      const response = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify(context),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw Error(
          typeof data?.error === "string"
            ? data.error
            : `创作服务暂不可用 (${response.status})`,
        );
      }
      const value: unknown = await response.json();
      signal.throwIfAborted();
      return value;
    },
  };
}
