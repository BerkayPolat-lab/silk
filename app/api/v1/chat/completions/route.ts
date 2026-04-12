import { createHash } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import {
  debitUsage,
  estimateMaxCostCents,
  meteredErrorResponse,
  roughPromptTokensFromMessages,
  usageCostCents,
  wrapStreamWithUsageDebit,
} from "@/lib/billing/meteredUsage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRole = "user" | "assistant" | "system";

type ModelRow = {
  id: string;
  slug: string;
  litellm_model_id: string | null;
  input_price_per_million_cents: number;
  output_price_per_million_cents: number;
};

const MAX_BODY_MESSAGES = 64;
const MAX_MESSAGE_CHARS = 100_000;
const DEFAULT_MAX_TOKENS = 1024;

function extractBearer(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m?.[1]?.trim() ?? null;
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function normalizeMessages(body: Record<string, unknown>): Array<{
  role: ChatRole;
  content: string;
}> | null {
  const raw = body.messages;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  if (raw.length > MAX_BODY_MESSAGES) return null;

  const out: Array<{ role: ChatRole; content: string }> = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const role = (m as { role?: string }).role;
    const content = (m as { content?: unknown }).content;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_CHARS) continue;
    if (role !== "user" && role !== "assistant" && role !== "system") {
      continue;
    }
    out.push({ role: role as ChatRole, content: trimmed });
  }
  return out.length ? out : null;
}

export async function POST(request: Request) {
  const rawKey = extractBearer(request);
  if (!rawKey || !rawKey.startsWith("sk_")) {
    return meteredErrorResponse(
      401,
      "Missing or invalid Authorization Bearer token"
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return meteredErrorResponse(400, "Invalid JSON body");
  }

  const modelSlug = body.model;
  if (typeof modelSlug !== "string" || !modelSlug.trim()) {
    return meteredErrorResponse(400, "Missing or invalid model");
  }

  const messages = normalizeMessages(body);
  if (!messages) {
    return meteredErrorResponse(400, "Invalid or empty messages array");
  }

  const streamRequested = body.stream === true;
  const maxCap = Number(process.env.GATEWAY_MAX_TOKENS ?? 8192);
  let maxTokens = DEFAULT_MAX_TOKENS;
  if (typeof body.max_tokens === "number" && Number.isFinite(body.max_tokens)) {
    maxTokens = Math.min(Math.max(1, Math.floor(body.max_tokens)), maxCap);
  }

  const supabase = createServiceRoleClient();
  const keyHash = hashKey(rawKey);

  const { data: keyRow, error: keyErr } = await supabase
    .from("user_api_keys")
    .select("id, user_id")
    .eq("key_hash", keyHash)
    .eq("key_type", "platform")
    .maybeSingle();

  if (keyErr || !keyRow?.user_id || !keyRow.id) {
    return meteredErrorResponse(401, "Invalid API key");
  }

  const { data: model, error: modelErr } = await supabase
    .from("models")
    .select(
      "id, slug, litellm_model_id, input_price_per_million_cents, output_price_per_million_cents"
    )
    .eq("slug", modelSlug.trim())
    .maybeSingle();

  if (modelErr || !model?.litellm_model_id) {
    return meteredErrorResponse(
      404,
      "Model not found or not available for API access",
      "model_not_found"
    );
  }

  const m = model as ModelRow;
  const inPpm = Number(m.input_price_per_million_cents) || 0;
  const outPpm = Number(m.output_price_per_million_cents) || 0;

  const { data: wallet, error: walletErr } = await supabase
    .from("user_wallets")
    .select("balance_cents")
    .eq("user_id", keyRow.user_id)
    .maybeSingle();

  if (walletErr) {
    return meteredErrorResponse(500, "Could not load wallet");
  }

  const balance = Number(wallet?.balance_cents ?? 0);
  const promptEst = roughPromptTokensFromMessages(messages as unknown[]);
  const estCost = estimateMaxCostCents(promptEst, maxTokens, inPpm, outPpm);

  if (!Number.isFinite(balance) || balance <= 0 || balance < estCost) {
    return meteredErrorResponse(
      402,
      "Insufficient prepaid balance for this request. Add funds in the Silk billing page.",
      "insufficient_funds"
    );
  }

  const proxyUrl = process.env.LITELLM_PROXY_URL ?? "http://localhost:4000";
  const serviceKey = process.env.LITELLM_SERVICE_API_KEY;

  const temperature =
    typeof body.temperature === "number" && Number.isFinite(body.temperature)
      ? body.temperature
      : 0.7;

  const upstreamBody: Record<string, unknown> = {
    model: `openrouter/${m.litellm_model_id}`,
    messages,
    temperature,
    stream: streamRequested,
    max_tokens: maxTokens,
  };

  if (streamRequested) {
    upstreamBody.stream_options = { include_usage: true };
  }

  const liteRes = await fetch(`${proxyUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(serviceKey ? { Authorization: `Bearer ${serviceKey}` } : {}),
    },
    body: JSON.stringify(upstreamBody),
  });

  if (!liteRes.ok) {
    const text = await liteRes.text().catch(() => "");
    return new Response(
      JSON.stringify({
        error: {
          message: text || "Upstream LLM request failed",
          type: "api_error",
          code: "upstream_error",
        },
      }),
      {
        status: liteRes.status >= 400 ? liteRes.status : 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!streamRequested) {
    const json = (await liteRes.json()) as {
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
      };
    };

    const pt = Math.max(
      0,
      json.usage?.prompt_tokens ??
        roughPromptTokensFromMessages(messages as unknown[])
    );
    const ct = Math.max(
      0,
      json.usage?.completion_tokens ?? Math.min(maxTokens, 512)
    );

    const cost = usageCostCents(pt, ct, inPpm, outPpm);
    const ok = await debitUsage(
      keyRow.user_id,
      m.id,
      keyRow.id,
      pt,
      ct,
      cost
    );

    if (!ok) {
      return meteredErrorResponse(
        402,
        "Could not complete billing for this request (insufficient balance).",
        "insufficient_funds"
      );
    }

    return new Response(JSON.stringify(json), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!liteRes.body) {
    return meteredErrorResponse(500, "Empty upstream response body");
  }

  const userId = keyRow.user_id;
  const apiKeyId = keyRow.id;
  const modelId = m.id;

  const outStream = wrapStreamWithUsageDebit(liteRes.body, async (usage) => {
    let pt = Math.max(0, usage.prompt_tokens);
    let ct = Math.max(0, usage.completion_tokens);
    if (pt === 0 && ct === 0) {
      pt = roughPromptTokensFromMessages(messages as unknown[]);
      ct = Math.min(maxTokens, 256);
    }
    const cost = usageCostCents(pt, ct, inPpm, outPpm);
    const ok = await debitUsage(userId, modelId, apiKeyId, pt, ct, cost);
    if (!ok) {
      console.error(
        "metered gateway: debit failed after streamed response (user may need to add funds)"
      );
    }
  });

  return new Response(outStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
