/** Provider wire adapter. Original response text is captured before parsing. */
export function createCreativeCall(env, signal, observe, transport = fetch) {
  const provider = env.NARRATIVE_PROVIDER || "ollama",
    base = (env.NARRATIVE_BASE_URL || "http://127.0.0.1:11434").replace(
      /\/$/,
      "",
    ),
    model = env.NARRATIVE_MODEL;
  return async function call(
    prompt,
    payload,
    schema,
    budget,
    phase = "composition",
  ) {
    const thinking =
      env.CREATIVE_THINKING === "true" ||
      (prompt.startsWith("你是歌曲叙事") &&
        env.CREATIVE_INTENT_THINKING === "true");
    const response = await transport(
      base + (provider === "ollama" ? "/api/chat" : "/chat/completions"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.NARRATIVE_API_KEY
            ? { Authorization: `Bearer ${env.NARRATIVE_API_KEY}` }
            : {}),
        },
        signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: JSON.stringify(payload) },
          ],
          ...(provider === "ollama"
            ? {
                stream: false,
                think: thinking,
                format: schema,
                options: {
                  temperature: 0.45,
                  num_ctx: Math.min(
                    32768,
                    Math.max(
                      8192,
                      Number(env.CREATIVE_CONTEXT_TOKENS) || 24576,
                    ),
                  ),
                  num_predict: budget + (thinking ? 4096 : 0),
                },
              }
            : { temperature: 0.45, response_format: { type: "json_object" } }),
        }),
      },
    );
    if (!response.ok) throw Error(`创作模型服务返回 ${response.status}`);
    const data = await response.json(),
      raw =
        provider === "ollama"
          ? data.message?.content
          : data.choices?.[0]?.message?.content;
    if (typeof raw !== "string" || raw.length > 200000)
      throw Error("创作模型返回了无效文本");
    observe({
      prompt: phase,
      raw,
      doneReason: data.done_reason,
      tokens: data.eval_count,
      thinkingCharacters: data.message?.thinking?.length ?? 0,
      metrics:
        provider === "ollama"
          ? {
              promptTokens: data.prompt_eval_count,
              totalSeconds: (data.total_duration ?? 0) / 1e9,
              loadSeconds: (data.load_duration ?? 0) / 1e9,
              generationSeconds: (data.eval_duration ?? 0) / 1e9,
            }
          : undefined,
    });
    return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  };
}
