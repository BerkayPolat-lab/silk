#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../..");

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models?output_modalities=text";
const METRIK_TTFT_URL = "https://metrik.vercel.app/api/v1/ttft";
const INFERENCE_LATENCY_THROUGHPUT_URL = "https://inferencelatency.com/throughput";

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function normalizeModelId(value) {
  if (!value) return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/:free$/g, "")
    .replace(/^x-ai\//, "xai/")
    .replace(/^z-ai\//, "zai/")
    .replace(/\s+/g, "-");
}

function slugify(value) {
  if (!value) return "";
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeLookupKey(value) {
  return slugify(value).replace(/^x-ai-/, "xai-");
}

function stripVersionSuffix(value) {
  if (!value) return "";
  // Claude feeds often use family names (e.g. claude-sonnet-4) while DB has point versions (claude-sonnet-4.6).
  return String(value).replace(/-\d+(?:[.-]\d+)?$/g, "");
}

function normalizeProviderKey(value) {
  if (!value) return "";
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function modelProviderKey(model) {
  const litellm = normalizeModelId(model.litellm_model_id);
  const prefix = litellm.includes("/") ? litellm.split("/")[0] : litellm;
  const providerAlias = {
    anthropic: "anthropic",
    claude: "claude",
    google: "googlegemini",
    "x-ai": "xai",
    xai: "xai",
    openai: "openai",
    deepseek: "deepseek",
    groq: "groq",
    mistral: "openrouter",
    cohere: "cohere",
    together: "togetherai",
    togetherai: "togetherai",
    moonshotai: "moonshotai",
    minimax: "minimax",
    stepfun: "stepfun",
    "z-ai": "zai",
    zai: "zai",
    qwen: "qwen",
    xiaomi: "xiaomi",
    nvidia: "nvidia",
  };
  return providerAlias[prefix] ?? normalizeProviderKey(prefix);
}

function providerAliasesFor(key) {
  if (!key) return [];
  if (key === "anthropic") return ["anthropic", "claude"];
  if (key === "claude") return ["claude", "anthropic"];
  return [key];
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  return value == null ? "NULL" : String(value);
}

async function loadFallbackData() {
  const fallbackPath = path.resolve(__dirname, "fallback-metadata.json");
  const raw = await readFile(fallbackPath, "utf8");
  const parsed = JSON.parse(raw);
  const map = new Map();
  for (const row of parsed.models ?? []) {
    const key = normalizeModelId(row.key);
    if (!key) continue;
    map.set(key, row);
  }
  return map;
}

async function fetchOpenRouterMap() {
  const res = await fetch(OPENROUTER_MODELS_URL);
  if (!res.ok) {
    throw new Error(`OpenRouter request failed: ${res.status}`);
  }
  const json = await res.json();
  const map = new Map();
  for (const row of json.data ?? []) {
    const id = normalizeModelId(row.id);
    if (!id) continue;
    map.set(id, {
      context_length_tokens: numberOrNull(row.context_length),
      source: "openrouter",
    });
  }
  return map;
}

function extractTps(model) {
  const candidates = [
    model.tokens_per_second,
    model.output_tokens_per_second,
    model.output_tps,
    model.tps,
    model.speed_tps,
  ];
  for (const c of candidates) {
    const n = numberOrNull(c);
    if (n != null) return n;
  }
  return null;
}

async function fetchMetrikMap() {
  const res = await fetch(METRIK_TTFT_URL);
  if (!res.ok) {
    throw new Error(`Metrik request failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`Metrik returned non-JSON payload (${contentType || "unknown content-type"})`);
  }
  const json = await res.json();
  const map = new Map();
  const providers = json?.data?.providers ?? [];
  for (const provider of providers) {
    for (const model of provider.models ?? []) {
      const keys = [model.model_id, model.name].map((x) => normalizeLookupKey(x)).filter(Boolean);
      if (keys.length === 0) continue;
      const value = {
        latency_ttft_ms: numberOrNull(model.ttft),
        throughput_tokens_per_sec: extractTps(model),
        source: "metrik",
      };
      for (const key of keys) map.set(key, value);
    }
  }
  return map;
}

async function fetchInferenceLatencyProviderMap() {
  const res = await fetch(INFERENCE_LATENCY_THROUGHPUT_URL);
  if (!res.ok) {
    throw new Error(`InferenceLatency request failed: ${res.status}`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`InferenceLatency returned non-JSON payload (${contentType || "unknown content-type"})`);
  }

  const json = await res.json();
  const map = new Map();

  function fromTrend(values) {
    if (!Array.isArray(values)) return null;
    const nums = values.map(numberOrNull).filter((n) => n != null);
    if (nums.length === 0) return null;
    // Use latest observed point from the trend as current approximation.
    return nums[nums.length - 1];
  }

  function chooseBetter(existing, next) {
    if (!existing) return next;
    const existingHasSignal =
      existing.latency_ttft_ms != null || existing.throughput_tokens_per_sec != null;
    const nextHasSignal = next.latency_ttft_ms != null || next.throughput_tokens_per_sec != null;
    if (!existingHasSignal && nextHasSignal) return next;
    if (existingHasSignal && !nextHasSignal) return existing;
    const existingLatency = existing.latency_ttft_ms ?? Number.POSITIVE_INFINITY;
    const nextLatency = next.latency_ttft_ms ?? Number.POSITIVE_INFINITY;
    if (nextLatency < existingLatency) return next;
    return existing;
  }

  for (const row of json.providers ?? []) {
    const providerKey = normalizeProviderKey(row.provider);
    const modelKey = normalizeLookupKey(row.model);
    if (!providerKey && !modelKey) continue;
    const metrics = row.metrics ?? {};
    const health = row.health ?? {};
    const history = row.history ?? {};

    // Some providers return null live metrics for failed probes, while trend/history still has usable values.
    const latency =
      numberOrNull(metrics.latency_ms) ??
      fromTrend(history.latency_trend_7d) ??
      numberOrNull(health.warm_start_latency_ms) ??
      null;
    const throughput =
      numberOrNull(metrics.throughput_tokens_per_sec) ??
      fromTrend(history.throughput_trend_7d) ??
      null;

    const value = {
      latency_ttft_ms: latency,
      throughput_tokens_per_sec: throughput,
      source: "inferencelatency",
    };

    // Store by provider to preserve fallback behavior.
    if (providerKey) {
      map.set(providerKey, chooseBetter(map.get(providerKey), value));
    }

    // Also store by model-level keys so we can match specific models first.
    const modelKeys = new Set(
      [
        modelKey,
        row.model_metadata?.context_length != null ? normalizeLookupKey(row.model) : modelKey, // keep deterministic key set
        normalizeLookupKey(`${row.provider}/${row.model}`),
        normalizeLookupKey(`${row.provider}-${row.model}`),
      ].filter(Boolean)
    );
    for (const key of modelKeys) {
      map.set(key, chooseBetter(map.get(key), value));
    }
  }
  return map;
}

function modelLookupKeys(model) {
  const litellm = normalizeModelId(model.litellm_model_id);
  const modelPart = litellm.includes("/") ? litellm.split("/").slice(1).join("/") : litellm;
  const keys = [
    normalizeLookupKey(model.litellm_model_id),
    normalizeLookupKey(modelPart),
    normalizeLookupKey(model.slug),
    normalizeLookupKey(model.name),
    normalizeLookupKey(stripVersionSuffix(modelPart)),
    normalizeLookupKey(stripVersionSuffix(model.slug)),
    normalizeLookupKey(stripVersionSuffix(model.name)),
  ].filter(Boolean);
  return [...new Set(keys)];
}

function mergeSources(parts) {
  const unique = [...new Set(parts.filter(Boolean))];
  return unique.join("+") || null;
}

function buildUpdates(models, openrouterMap, metrikMap, inferenceLatencyMap, fallbackMap) {
  const updates = [];
  for (const model of models) {
    const litellm = normalizeModelId(model.litellm_model_id);
    const lookupKeys = modelLookupKeys(model);
    const openrouter = litellm ? openrouterMap.get(litellm) : null;

    let metrik = null;
    for (const key of lookupKeys) {
      metrik = metrikMap.get(key);
      if (metrik) break;
    }
    let providerPerf = null;
    for (const key of lookupKeys) {
      providerPerf = inferenceLatencyMap.get(key);
      if (providerPerf) break;
    }
    if (!providerPerf) {
      const providerKey = modelProviderKey(model);
      for (const pKey of providerAliasesFor(providerKey)) {
        providerPerf = inferenceLatencyMap.get(pKey);
        if (providerPerf) break;
      }
    }

    const fallback = (litellm && fallbackMap.get(litellm)) || null;

    const context_length_tokens =
      openrouter?.context_length_tokens ??
      numberOrNull(fallback?.context_length_tokens) ??
      null;
    const latency_ttft_ms =
      metrik?.latency_ttft_ms ??
      providerPerf?.latency_ttft_ms ??
      numberOrNull(fallback?.latency_ttft_ms) ??
      null;
    const throughput_tokens_per_sec =
      metrik?.throughput_tokens_per_sec ??
      providerPerf?.throughput_tokens_per_sec ??
      numberOrNull(fallback?.throughput_tokens_per_sec) ??
      null;
    const gb_size = model.gb_size ?? numberOrNull(fallback?.gb_size) ?? null;
    const perf_source = mergeSources([openrouter?.source, metrik?.source, providerPerf?.source, fallback?.source]);

    const hasAny =
      context_length_tokens != null ||
      latency_ttft_ms != null ||
      throughput_tokens_per_sec != null ||
      gb_size != null;
    if (!hasAny) continue;

    updates.push({
      id: model.id,
      slug: model.slug,
      litellm_model_id: model.litellm_model_id,
      context_length_tokens,
      latency_ttft_ms,
      throughput_tokens_per_sec,
      gb_size,
      perf_source,
    });
  }
  return updates;
}

function buildUpdateSql(rows) {
  if (rows.length === 0) return "-- No model metadata updates generated.\n";
  const now = new Date().toISOString();
  const values = rows
    .map(
      (r) =>
        `(${sqlString(r.id)}::uuid, ${sqlNumber(r.context_length_tokens)}::bigint, ${sqlNumber(r.latency_ttft_ms)}::integer, ${sqlNumber(
          r.throughput_tokens_per_sec
        )}::numeric, ${sqlNumber(r.gb_size)}::numeric, ${r.perf_source ? `${sqlString(r.perf_source)}::text` : "NULL::text"}, ${sqlString(
          now
        )}::timestamptz)`
    )
    .join(",\n");

  return `WITH updates (id, context_length_tokens, latency_ttft_ms, throughput_tokens_per_sec, gb_size, perf_source, perf_updated_at) AS (
  VALUES
${values}
)
UPDATE public.models AS m
SET
  context_length_tokens = u.context_length_tokens,
  latency_ttft_ms = u.latency_ttft_ms,
  throughput_tokens_per_sec = u.throughput_tokens_per_sec,
  gb_size = COALESCE(u.gb_size, m.gb_size),
  perf_source = u.perf_source,
  perf_updated_at = u.perf_updated_at
FROM updates AS u
WHERE m.id = u.id;`;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const outJson = getArg("--out-json") ?? path.resolve(workspaceRoot, "tmp/model-metadata-updates.json");
  const outSql = getArg("--out-sql") ?? path.resolve(workspaceRoot, "tmp/model-metadata-updates.sql");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const metrikPromise = fetchMetrikMap().catch((err) => {
    console.warn(`Metrik source unavailable: ${err.message}`);
    return new Map();
  });
  const inferenceLatencyPromise = fetchInferenceLatencyProviderMap().catch((err) => {
    console.warn(`InferenceLatency source unavailable: ${err.message}`);
    return new Map();
  });

  const [{ data: models, error }, openrouterMap, metrikMap, inferenceLatencyMap, fallbackMap] = await Promise.all([
    supabase
      .from("models")
      .select("id, name, slug, litellm_model_id, gb_size")
      .order("rank_order", { ascending: true, nullsFirst: false }),
    fetchOpenRouterMap(),
    metrikPromise,
    inferenceLatencyPromise,
    loadFallbackData(),
  ]);

  if (error) throw error;

  const updates = buildUpdates(models ?? [], openrouterMap, metrikMap, inferenceLatencyMap, fallbackMap);
  const sql = buildUpdateSql(updates);

  await mkdir(path.dirname(outJson), { recursive: true });
  await mkdir(path.dirname(outSql), { recursive: true });
  await writeFile(outJson, JSON.stringify({ count: updates.length, updates }, null, 2));
  await writeFile(outSql, sql);

  console.log(`Prepared metadata for ${updates.length} model rows.`);
  console.log(`JSON: ${outJson}`);
  console.log(`SQL: ${outSql}`);

  if (hasFlag("--print-sources")) {
    console.log("Source endpoints:");
    console.log(`- OpenRouter: ${OPENROUTER_MODELS_URL}`);
    console.log(`- Metrik TTFT: ${METRIK_TTFT_URL}`);
    console.log(`- InferenceLatency throughput: ${INFERENCE_LATENCY_THROUGHPUT_URL}`);
    console.log("- Throughput fallback: scripts/model-metadata/fallback-metadata.json");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
