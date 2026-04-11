import { createServiceRoleClient } from "@/lib/supabase/service";

export function roughPromptTokensFromMessages(messages: unknown[]): number {
  if (!Array.isArray(messages)) return 256;
  let chars = 0;
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const c = (m as { content?: unknown }).content;
    if (typeof c === "string") chars += c.length;
  }
  return Math.max(64, Math.ceil(chars / 4));
}

export function estimateMaxCostCents(
  promptTokEst: number,
  maxOutTokens: number,
  inPpm: number,
  outPpm: number
): number {
  const raw =
    (promptTokEst * inPpm + maxOutTokens * outPpm) / 1_000_000;
  return Math.max(0, Math.ceil(raw));
}

export function usageCostCents(
  promptTokens: number,
  completionTokens: number,
  inPpm: number,
  outPpm: number
): number {
  const raw =
    (promptTokens * inPpm + completionTokens * outPpm) / 1_000_000;
  return Math.max(0, Math.ceil(raw));
}

/** Metered calls must pass the authenticated user's platform `user_api_keys.id`. */
export async function debitUsage(
  userId: string,
  modelId: string,
  apiKeyId: string,
  promptTokens: number,
  completionTokens: number,
  costCents: number
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("debit_usage_and_log", {
    p_user_id: userId,
    p_model_id: modelId,
    p_api_key_id: apiKeyId,
    p_prompt_tokens: promptTokens,
    p_completion_tokens: completionTokens,
    p_cost_cents: costCents,
  });
  if (error) {
    console.error("debit_usage_and_log", error);
    return false;
  }
  return data === true;
}

export function wrapStreamWithUsageDebit(
  upstream: ReadableStream<Uint8Array>,
  onDone: (usage: {
    prompt_tokens: number;
    completion_tokens: number;
  }) => Promise<void>
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let carry = "";
  let lastUsage: { prompt_tokens?: number; completion_tokens?: number } | null =
    null;

  return upstream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
        carry += decoder.decode(chunk, { stream: true });
        const lines = carry.split("\n");
        carry = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as {
              usage?: {
                prompt_tokens?: number;
                completion_tokens?: number;
              };
            };
            if (parsed.usage) {
              lastUsage = parsed.usage;
            }
          } catch {
            // ignore partial JSON
          }
        }
      },
      async flush() {
        if (carry.length > 0) {
          const line = carry;
          if (line.startsWith("data: ")) {
            const payload = line.slice(6).trim();
            if (payload !== "[DONE]") {
              try {
                const parsed = JSON.parse(payload) as {
                  usage?: {
                    prompt_tokens?: number;
                    completion_tokens?: number;
                  };
                };
                if (parsed.usage) lastUsage = parsed.usage;
              } catch {
                /* empty */
              }
            }
          }
        }
        const pt = Math.max(0, lastUsage?.prompt_tokens ?? 0);
        const ct = Math.max(0, lastUsage?.completion_tokens ?? 0);
        await onDone({ prompt_tokens: pt, completion_tokens: ct });
      },
    })
  );
}

export function meteredErrorResponse(
  status: number,
  message: string,
  code?: string
): Response {
  return new Response(
    JSON.stringify({
      error: {
        message,
        type: status === 401 ? "invalid_request_error" : "api_error",
        code:
          code ??
          (status === 402 ? "insufficient_funds" : "invalid_request"),
      },
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
