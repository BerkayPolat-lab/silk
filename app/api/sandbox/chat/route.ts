import { createClient } from "@/lib/supabase/server";

type ChatRole = "user" | "assistant" | "system";

type IncomingMessage = {
  role: ChatRole;
  content: string;
};

type Body = {
  modelSlug: string;
  messages: IncomingMessage[];
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

  // Validate and normalize messages.
  const normalized: Array<{ role: ChatRole; content: string }> = [];
  for (const m of body.messages) {
    if (!m || typeof m.content !== "string") continue;
    const role = m.role;
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    const content = m.content.trim();
    if (!content) continue;
    // Hard caps to reduce spend + abuse.
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
    return new Response(
      JSON.stringify({ error: "Prompt too large" }),
      {
        status: 413,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // Allowlist model: ignore any client-provided LiteLLM model id.
  const { data: model, error: modelError } = await supabase
    .from("models")
    .select("id, slug, litellm_model_id")
    .eq("slug", body.modelSlug)
    .single();

  if (modelError || !model?.litellm_model_id) {
    return new Response(JSON.stringify({ error: "Model not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const proxyUrl = process.env.LITELLM_PROXY_URL ?? "http://localhost:4000";
  const serviceKey = process.env.LITELLM_SERVICE_API_KEY; // optional

  const liteRes = await fetch(`${proxyUrl}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(serviceKey ? { Authorization: `Bearer ${serviceKey}` } : {}),
    },
    body: JSON.stringify({
      // Route requests through LiteLLM's OpenRouter provider.
      model: `openrouter/${model.litellm_model_id}`,
      messages: normalized.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: 0.7,
      stream: true,
      max_tokens: Number(process.env.SANDBOX_MAX_TOKENS ?? 512),
    }),
  });

  if (!liteRes.ok || !liteRes.body) {
    const text = await liteRes.text().catch(() => "");
    return new Response(
      JSON.stringify({
        error: "LiteLLM request failed",
        details: text || undefined,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  // Pass-through SSE from LiteLLM to the browser.
  return new Response(liteRes.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

