export interface ModelReadiness {
  configured: boolean;
  model: string;
  ready?: boolean | null;
  detail?: string;
}
export interface ModelStatus extends ModelReadiness {
  sends?: "local" | "lyrics-and-features";
  creative?: ModelReadiness;
}
export async function getModelStatus(
  fetcher: typeof fetch = (...args) => fetch(...args),
): Promise<ModelStatus> {
  const response = await fetcher("/api/narrative/status");
  if (!response.ok) throw Error("模型状态暂不可用");
  return response.json();
}
