import { createClient } from "@/lib/supabase/server";
import {
  debitUsage,
  estimateMaxCostCents,
  roughPromptTokensFromMessages,
  usageCostCents,
  wrapStreamWithUsageDebit,
} from "@/lib/billing/meteredUsage";

type ChatRole = "user" | "assistant" | "system";

type IncomingMessage = {
  role: ChatRole;
  content: string;
};

type Body = {
  modelSlug: string;
  messages: IncomingMessage[];
};

type ModelRow = {
  id: string;
  litellm_model_id: string;
  input_price_per_million_cents: number;
  output_price_per_million_cents: number;
};

// Simple in-memory rate limit for development/testing.
// For production, swap this for a shared store (Redis/Upstash).
const rateWindows = new Map<
  string,
  { windowStartMs: number; count: number }
>();

function isRateLimited(key: string) {
  const windowMs = Number(process.env.SANDBOX_RATE_WINDOW_MS ?? 60_000);
  const max = Number(process.env.SANDBOX_RATE_MAX ?? 30);
  const now = Date.now();

  const existing = rateWindows.get(key);
  if (!existing) {
    rateWindows.set(key, { windowStartMs: now, count: 1 });
    return false;
  }

  const elapsed = now - existing.windowStartMs;
  if (elapsed > windowMs) {
    rateWindows.set(key, { windowStartMs: now, count: 1 });
    return false;
  }

  if (existing.count >= max) return true;
  rateWindows.set(key, { ...existing, count: existing.count + 1 });
  return false;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body?.modelSlug || !Array.isArray(body.messages)) {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const forwardedFor =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const rateKey = `${user.id}:${forwardedFor}`;
  if (isRateLimited(rateKey)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const normalized: Array<{ role: ChatRole; content: string }> = [];
  for (const m of body.messages) {
    if (!m || typeof m.content !== "string") continue;
    const role = m.role;
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    const content = m.content.trim();
    if (!content) continue;
    if (content.length > 4000) continue;
    normalized.push({ role, content });
  }

  if (normalized.length === 0) {
    return new Response(JSON.stringify({ error: "No messages provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (normalized.reduce((acc, m) => acc + m.content.length, 0) > 32_000) {
    return new Response(JSON.stringify({ error: "Prompt too large" }), {
      status: 413,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Use the same session-scoped client as the dashboard. Service-role reads can
  // return no rows if SUPABASE_SERVICE_ROLE_KEY is missing/mismatched vs the anon URL.
  const { data: platformKey, error: keyErr } = await supabase
    .from("user_api_keys")
    .select("id")
    .eq("user_id", user.id)
    .eq("key_type", "platform")
    .maybeSingle();

  if (keyErr) {
    return new Response(JSON.stringify({ error: "Could not verify API key" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!platformKey?.id) {
    return new Response(
      JSON.stringify({
        error:
          "Create a Silk platform API key in the dashboard (and add funds) before using the sandbox.",
        code: "PLATFORM_KEY_REQUIRED",
      }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  const { data: model, error: modelError } = await supabase
    .from("models")
    .select(
      "id, litellm_model_id, input_price_per_million_cents, output_price_per_million_cents"
    )
    .eq("slug", body.modelSlug)
    .maybeSingle();

  if (modelError || !model?.litellm_model_id) {
    return new Response(JSON.stringify({ error: "Model not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const mRow = model as ModelRow;
  const inPpm = Number(mRow.input_price_per_million_cents) || 0;
  const outPpm = Number(mRow.output_price_per_million_cents) || 0;

  const maxCap = Number(process.env.GATEWAY_MAX_TOKENS ?? 8192);
  let maxTokens = Number(process.env.SANDBOX_MAX_TOKENS ?? 512);
  if (!Number.isFinite(maxTokens) || maxTokens < 1) maxTokens = 512;
  maxTokens = Math.min(Math.floor(maxTokens), maxCap);

  const { data: wallet, error: walletErr } = await supabase
    .from("user_wallets")
    .select("balance_cents")
    .eq("user_id", user.id)
    .maybeSingle();

  if (walletErr) {
    return new Response(JSON.stringify({ error: "Could not load wallet" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const balance = Number(wallet?.balance_cents ?? 0);
  const promptEst = roughPromptTokensFromMessages(normalized as unknown[]);
  const estCost = estimateMaxCostCents(promptEst, maxTokens, inPpm, outPpm);

  if (!Number.isFinite(balance) || balance <= 0 || balance < estCost) {
    return new Response(
      JSON.stringify({
        error:
          "Insufficient prepaid balance for this request. Add funds in the Silk billing page.",
        code: "INSUFFICIENT_FUNDS",
      }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (!openrouterKey) {
    return new Response(
      JSON.stringify({ error: "OPENROUTER_API_KEY is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const liteRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openrouterKey}`,
    },
    body: JSON.stringify({
      model: mRow.litellm_model_id,
      messages: normalized.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: 0.7,
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: maxTokens,
    }),
  });

  if (!liteRes.ok || !liteRes.body) {
    const text = await liteRes.text().catch(() => "");
    return new Response(
      JSON.stringify({
        error: "OpenRouter request failed",
        details: text || undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const userId = user.id;
  const modelId = mRow.id;
  const apiKeyId = platformKey.id;

  const outStream = wrapStreamWithUsageDebit(liteRes.body, async (usage) => {
    let pt = Math.max(0, usage.prompt_tokens);
    let ct = Math.max(0, usage.completion_tokens);
    if (pt === 0 && ct === 0) {
      pt = roughPromptTokensFromMessages(normalized as unknown[]);
      ct = Math.min(maxTokens, 256);
    }
    const cost = usageCostCents(pt, ct, inPpm, outPpm);
    const ok = await debitUsage(userId, modelId, apiKeyId, pt, ct, cost);
    if (!ok) {
      console.error(
        "sandbox chat: debit failed after streamed response (user may need to add funds)"
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
