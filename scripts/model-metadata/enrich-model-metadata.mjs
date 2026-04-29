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

function titleCaseWords(value) {
  return String(value)
    .split(/[\s-]+/g)
    .filter(Boolean)
    .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
    .join(" ");
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

const PROVIDER_COMPANY_DEFAULTS = {
  openai: {
    provider_name: "openai",
    company_name: "OpenAI",
    website: "https://openai.com",
    logo_url: "https://openai.com/favicon.ico",
    api_docs: "https://platform.openai.com/docs",
  },
  anthropic: {
    provider_name: "anthropic",
    company_name: "Anthropic",
    website: "https://anthropic.com",
    logo_url: "https://anthropic.com/favicon.ico",
    api_docs: "https://docs.anthropic.com",
  },
  claude: {
    provider_name: "anthropic",
    company_name: "Anthropic",
    website: "https://anthropic.com",
    logo_url: "https://anthropic.com/favicon.ico",
    api_docs: "https://docs.anthropic.com",
  },
  googlegemini: {
    provider_name: "google",
    company_name: "Google",
    website: "https://ai.google.dev",
    logo_url: "https://www.google.com/favicon.ico",
    api_docs: "https://ai.google.dev/gemini-api/docs",
  },
  google: {
    provider_name: "google",
    company_name: "Google",
    website: "https://ai.google.dev",
    logo_url: "https://www.google.com/favicon.ico",
    api_docs: "https://ai.google.dev/gemini-api/docs",
  },
  xai: {
    provider_name: "x-ai",
    company_name: "xAI",
    website: "https://x.ai",
    logo_url: "https://x.ai/favicon.ico",
    api_docs: "https://docs.x.ai",
  },
  "x-ai": {
    provider_name: "x-ai",
    company_name: "xAI",
    website: "https://x.ai",
    logo_url: "https://x.ai/favicon.ico",
    api_docs: "https://docs.x.ai",
  },
  deepseek: {
    provider_name: "deepseek",
    company_name: "DeepSeek",
    website: "https://deepseek.com",
    logo_url: "https://deepseek.com/favicon.ico",
    api_docs: "https://platform.deepseek.com/api-docs",
  },
  minimax: {
    provider_name: "minimax",
    company_name: "MiniMax",
    website: "https://minimax.chat",
    logo_url: "https://minimax.chat/favicon.ico",
    api_docs: null,
  },
  moonshotai: {
    provider_name: "moonshotai",
    company_name: "Moonshot AI",
    website: "https://moonshot.cn",
    logo_url: "https://moonshot.cn/favicon.ico",
    api_docs: null,
  },
  mistral: {
    provider_name: "mistral",
    company_name: "Mistral AI",
    website: "https://mistral.ai",
    logo_url: "https://mistral.ai/favicon.ico",
    api_docs: "https://docs.mistral.ai",
  },
  cohere: {
    provider_name: "cohere",
    company_name: "Cohere",
    website: "https://cohere.com",
    logo_url: "https://cohere.com/favicon.ico",
    api_docs: "https://docs.cohere.com",
  },
  togetherai: {
    provider_name: "togetherai",
    company_name: "Together AI",
    website: "https://together.ai",
    logo_url: "https://together.ai/favicon.ico",
    api_docs: "https://docs.together.ai",
  },
  groq: {
    provider_name: "groq",
    company_name: "Groq",
    website: "https://groq.com",
    logo_url: "https://groq.com/favicon.ico",
    api_docs: "https://console.groq.com/docs",
  },
  qwen: {
    provider_name: "qwen",
    company_name: "Alibaba Cloud",
    website: "https://www.alibabacloud.com",
    logo_url: "https://www.alibabacloud.com/favicon.ico",
    api_docs: "https://help.aliyun.com/zh/dashscope",
  },
  zai: {
    provider_name: "z-ai",
    company_name: "Zhipu AI",
    website: "https://open.bigmodel.cn",
    logo_url: "https://open.bigmodel.cn/favicon.ico",
    api_docs: "https://open.bigmodel.cn/dev/api",
  },
  "z-ai": {
    provider_name: "z-ai",
    company_name: "Zhipu AI",
    website: "https://open.bigmodel.cn",
    logo_url: "https://open.bigmodel.cn/favicon.ico",
    api_docs: "https://open.bigmodel.cn/dev/api",
  },
};

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

function canonicalModelSlug(rawId) {
  const normalized = normalizeModelId(rawId);
  const modelPart = normalized.includes("/") ? normalized.split("/").slice(1).join("/") : normalized;
  const fromSlash = slugify(modelPart);
  return fromSlash || slugify(normalized);
}

function inferProviderKeyFromModelId(rawId) {
  const normalized = normalizeModelId(rawId);
  const prefix = normalized.includes("/") ? normalized.split("/")[0] : normalized;
  return normalizeProviderKey(prefix);
}

function resolveProviderCompanyMeta(providerKey) {
  const canonical = normalizeProviderKey(providerKey);
  const resolved = PROVIDER_COMPANY_DEFAULTS[canonical];
  if (resolved) return resolved;
  const providerName = canonical || "unknown";
  return {
    provider_name: providerName,
    company_name: titleCaseWords(providerName),
    website: null,
    logo_url: null,
    api_docs: null,
  };
}

async function fetchOpenRouterCatalog() {
  const res = await fetch(OPENROUTER_MODELS_URL);
  if (!res.ok) {
    throw new Error(`OpenRouter request failed: ${res.status}`);
  }
  const json = await res.json();
  const map = new Map();
  const rows = [];
  for (const row of json.data ?? []) {
    const id = normalizeModelId(row.id);
    if (!id) continue;
    const providerKey = inferProviderKeyFromModelId(id);
    const resolvedMeta = resolveProviderCompanyMeta(providerKey);
    const catalogRow = {
      openrouter_id: id,
      name: row.name ?? id,
      slug: canonicalModelSlug(id),
      litellm_model_id: id,
      provider_key: providerKey,
      context_length_tokens: numberOrNull(row.context_length),
      description: row.description ?? null,
      website: row.homepage ?? resolvedMeta.website ?? null,
      logo_url: row.icon_url ?? resolvedMeta.logo_url ?? null,
      api_docs: row.api_docs ?? resolvedMeta.api_docs ?? null,
      company_name: resolvedMeta.company_name,
      provider_name: resolvedMeta.provider_name,
    };
    rows.push(catalogRow);
    map.set(id, {
      context_length_tokens: numberOrNull(row.context_length),
      source: "openrouter",
    });
  }
  return { map, rows };
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

function completenessScore(row) {
  const fields = [
    "description",
    "context_length_tokens",
    "latency_ttft_ms",
    "throughput_tokens_per_sec",
    "api_docs",
    "website",
    "logo_url",
    "litellm_model_id",
    "perf_source",
  ];
  const present = fields.filter((f) => row[f] != null && row[f] !== "");
  return { score: present.length, fields: present };
}

function dedupeBySlugKeepingHighestCompleteness(rows) {
  const map = new Map();
  for (const row of rows) {
    if (!row.slug) continue;
    const prev = map.get(row.slug);
    if (!prev) {
      map.set(row.slug, row);
      continue;
    }
    const a = completenessScore(prev).score;
    const b = completenessScore(row).score;
    if (b > a) map.set(row.slug, row);
  }
  return [...map.values()];
}

function selectTopCandidates(rows, { limit, existingProviderKeys, existingCompanyNames }) {
  const scored = rows.map((row) => {
    const meta = resolveProviderCompanyMeta(row.provider_key);
    const providerKey = normalizeProviderKey(meta.provider_name ?? row.provider_key);
    const companyKey = (meta.company_name ?? "").toLowerCase().trim();
    const score = completenessScore(row);
    const existingProviderCompanyMatch =
      existingProviderKeys.has(providerKey) && existingCompanyNames.has(companyKey);
    return {
      ...row,
      company_name: meta.company_name ?? row.company_name,
      provider_name: meta.provider_name ?? row.provider_name,
      api_docs: row.api_docs ?? meta.api_docs,
      website: row.website ?? meta.website,
      logo_url: row.logo_url ?? meta.logo_url,
      completeness_score: score.score,
      completeness_fields: score.fields,
      existing_provider_company_match: existingProviderCompanyMatch,
      selection_bucket: existingProviderCompanyMatch ? "A" : "B",
    };
  });
  const bucketA = scored
    .filter((x) => x.selection_bucket === "A")
    .sort((a, b) => b.completeness_score - a.completeness_score);
  const bucketB = scored
    .filter((x) => x.selection_bucket === "B")
    .sort((a, b) => b.completeness_score - a.completeness_score);
  const selected = [...bucketA, ...bucketB].slice(0, limit);
  return { selected, scoredCount: scored.length };
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

function buildCatalogUpsertSql(selectedRows) {
  if (selectedRows.length === 0) return "-- No catalog upserts generated.\n";
  const now = new Date().toISOString();
  const rowsSql = selectedRows
    .map((r) => {
      const providerSlug = slugify(r.provider_name || r.provider_key);
      const providerName = r.provider_name || providerSlug;
      return `(
  ${sqlString(r.company_name)}::text,
  ${r.website ? `${sqlString(r.website)}::text` : "NULL::text"},
  ${r.logo_url ? `${sqlString(r.logo_url)}::text` : "NULL::text"},
  ${sqlString(providerName)}::text,
  ${sqlString(providerSlug)}::text,
  ${sqlString(r.name)}::text,
  ${sqlString(r.slug)}::text,
  ${r.description ? `${sqlString(r.description)}::text` : "NULL::text"},
  ${r.api_docs ? `${sqlString(r.api_docs)}::text` : "NULL::text"},
  ${sqlString(r.litellm_model_id)}::text,
  ${sqlNumber(r.context_length_tokens)}::bigint,
  ${sqlNumber(r.latency_ttft_ms)}::integer,
  ${sqlNumber(r.throughput_tokens_per_sec)}::numeric,
  ${r.perf_source ? `${sqlString(r.perf_source)}::text` : "NULL::text"},
  ${sqlString(now)}::timestamptz
)`;
    })
    .join(",\n");

  return `BEGIN;

WITH input_rows (
  company_name, website, logo_url, provider_name, provider_slug, model_name, model_slug, description,
  api_docs, litellm_model_id, context_length_tokens, latency_ttft_ms, throughput_tokens_per_sec, perf_source, perf_updated_at
) AS (
  VALUES
${rowsSql}
),
upsert_companies AS (
  INSERT INTO public.companies (name, website, logo_url)
  SELECT DISTINCT company_name, website, logo_url
  FROM input_rows
  ON CONFLICT ((lower(btrim(name))))
  DO UPDATE SET
    website = COALESCE(EXCLUDED.website, public.companies.website),
    logo_url = COALESCE(EXCLUDED.logo_url, public.companies.logo_url)
  RETURNING id, name
),
companies_resolved AS (
  SELECT c.id, c.name
  FROM public.companies c
  WHERE lower(btrim(c.name)) IN (SELECT lower(btrim(company_name)) FROM input_rows)
),
upsert_providers AS (
  INSERT INTO public.providers (company_id, name, slug)
  SELECT cr.id, ir.provider_name, ir.provider_slug
  FROM (SELECT DISTINCT company_name, provider_name, provider_slug FROM input_rows) ir
  JOIN companies_resolved cr ON lower(btrim(cr.name)) = lower(btrim(ir.company_name))
  ON CONFLICT (slug)
  DO UPDATE SET
    company_id = EXCLUDED.company_id,
    name = COALESCE(EXCLUDED.name, public.providers.name)
  RETURNING id, slug
),
providers_resolved AS (
  SELECT p.id, p.slug
  FROM public.providers p
  WHERE p.slug IN (SELECT provider_slug FROM input_rows)
)
INSERT INTO public.models (
  provider_id, name, slug, description, api_docs, litellm_model_id,
  context_length_tokens, latency_ttft_ms, throughput_tokens_per_sec, perf_source, perf_updated_at
)
SELECT
  pr.id, ir.model_name, ir.model_slug, ir.description, ir.api_docs, ir.litellm_model_id,
  ir.context_length_tokens, ir.latency_ttft_ms, ir.throughput_tokens_per_sec, ir.perf_source, ir.perf_updated_at
FROM input_rows ir
JOIN providers_resolved pr ON pr.slug = ir.provider_slug
ON CONFLICT (slug)
DO UPDATE SET
  provider_id = EXCLUDED.provider_id,
  name = COALESCE(EXCLUDED.name, public.models.name),
  description = COALESCE(EXCLUDED.description, public.models.description),
  api_docs = COALESCE(EXCLUDED.api_docs, public.models.api_docs),
  litellm_model_id = COALESCE(EXCLUDED.litellm_model_id, public.models.litellm_model_id),
  context_length_tokens = COALESCE(EXCLUDED.context_length_tokens, public.models.context_length_tokens),
  latency_ttft_ms = COALESCE(EXCLUDED.latency_ttft_ms, public.models.latency_ttft_ms),
  throughput_tokens_per_sec = COALESCE(EXCLUDED.throughput_tokens_per_sec, public.models.throughput_tokens_per_sec),
  perf_source = COALESCE(EXCLUDED.perf_source, public.models.perf_source),
  perf_updated_at = EXCLUDED.perf_updated_at;

-- Deduplicate companies by canonicalized name.
WITH ranked AS (
  SELECT id, lower(btrim(name)) AS canon_name, created_at,
         row_number() OVER (PARTITION BY lower(btrim(name)) ORDER BY created_at ASC, id ASC) AS rn,
         first_value(id) OVER (PARTITION BY lower(btrim(name)) ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.companies
),
dupes AS (
  SELECT id AS drop_id, keep_id
  FROM ranked
  WHERE rn > 1
),
repoint AS (
  UPDATE public.providers p
  SET company_id = d.keep_id
  FROM dupes d
  WHERE p.company_id = d.drop_id
)
DELETE FROM public.companies c USING dupes d WHERE c.id = d.drop_id;

-- Deduplicate providers by slug.
WITH ranked AS (
  SELECT id, slug, company_id, created_at,
         row_number() OVER (PARTITION BY slug ORDER BY created_at ASC, id ASC) AS rn,
         first_value(id) OVER (PARTITION BY slug ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.providers
),
dupes AS (
  SELECT id AS drop_id, keep_id
  FROM ranked
  WHERE rn > 1
),
repoint_models AS (
  UPDATE public.models m
  SET provider_id = d.keep_id
  FROM dupes d
  WHERE m.provider_id = d.drop_id
)
DELETE FROM public.providers p USING dupes d WHERE p.id = d.drop_id;

-- Deduplicate models by slug with metadata-aware precedence.
WITH ranked AS (
  SELECT id, slug, created_at,
         (CASE WHEN latency_ttft_ms IS NOT NULL AND throughput_tokens_per_sec IS NOT NULL THEN 1 ELSE 0 END) AS has_metrics,
         (CASE WHEN litellm_model_id IS NOT NULL THEN 1 ELSE 0 END) AS has_litellm,
         row_number() OVER (
           PARTITION BY slug
           ORDER BY
             (CASE WHEN latency_ttft_ms IS NOT NULL AND throughput_tokens_per_sec IS NOT NULL THEN 1 ELSE 0 END) DESC,
             (CASE WHEN litellm_model_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
             created_at ASC,
             id ASC
         ) AS rn,
         first_value(id) OVER (
           PARTITION BY slug
           ORDER BY
             (CASE WHEN latency_ttft_ms IS NOT NULL AND throughput_tokens_per_sec IS NOT NULL THEN 1 ELSE 0 END) DESC,
             (CASE WHEN litellm_model_id IS NOT NULL THEN 1 ELSE 0 END) DESC,
             created_at ASC,
             id ASC
         ) AS keep_id
  FROM public.models
),
dupes AS (
  SELECT id AS drop_id, keep_id
  FROM ranked
  WHERE rn > 1
),
merge_fields AS (
  UPDATE public.models keep_row
  SET
    description = COALESCE(keep_row.description, drop_row.description),
    api_docs = COALESCE(keep_row.api_docs, drop_row.api_docs),
    litellm_model_id = COALESCE(keep_row.litellm_model_id, drop_row.litellm_model_id),
    context_length_tokens = COALESCE(keep_row.context_length_tokens, drop_row.context_length_tokens),
    latency_ttft_ms = COALESCE(keep_row.latency_ttft_ms, drop_row.latency_ttft_ms),
    throughput_tokens_per_sec = COALESCE(keep_row.throughput_tokens_per_sec, drop_row.throughput_tokens_per_sec),
    perf_source = COALESCE(keep_row.perf_source, drop_row.perf_source),
    perf_updated_at = COALESCE(keep_row.perf_updated_at, drop_row.perf_updated_at)
  FROM dupes d
  JOIN public.models drop_row ON drop_row.id = d.drop_id
  WHERE keep_row.id = d.keep_id
),
repoint_reviews AS (
  UPDATE public.reviews r
  SET model_id = d.keep_id
  FROM dupes d
  WHERE r.model_id = d.drop_id
),
repoint_usage AS (
  UPDATE public.api_usage u
  SET model_id = d.keep_id
  FROM dupes d
  WHERE u.model_id = d.drop_id
)
DELETE FROM public.models m USING dupes d WHERE m.id = d.drop_id;

-- Remove malformed model slugs that became empty after normalization.
DELETE FROM public.models
WHERE slug IS NULL OR btrim(slug) = '';

COMMIT;`;
}

function buildValidationSql(selectedRows) {
  const selectedSlugs = selectedRows.map((r) => sqlString(r.slug)).join(", ");
  if (!selectedSlugs) return "-- No validation queries generated.\n";
  return `-- Selected rows should have both metrics.
SELECT slug, latency_ttft_ms, throughput_tokens_per_sec
FROM public.models
WHERE slug IN (${selectedSlugs})
  AND (latency_ttft_ms IS NULL OR throughput_tokens_per_sec IS NULL);

-- Duplicate checks.
SELECT slug, count(*) AS duplicate_count
FROM public.models
GROUP BY slug
HAVING count(*) > 1;

SELECT lower(btrim(name)) AS canonical_company_name, count(*) AS duplicate_count
FROM public.companies
GROUP BY lower(btrim(name))
HAVING count(*) > 1;

-- Orphan checks.
SELECT m.id, m.slug
FROM public.models m
LEFT JOIN public.providers p ON p.id = m.provider_id
WHERE p.id IS NULL;

SELECT p.id, p.slug
FROM public.providers p
LEFT JOIN public.companies c ON c.id = p.company_id
WHERE c.id IS NULL;`;
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const outJson = getArg("--out-json") ?? path.resolve(workspaceRoot, "tmp/model-catalog-upserts.json");
  const outSql = getArg("--out-sql") ?? path.resolve(workspaceRoot, "tmp/model-catalog-upserts.sql");
  const outValidationSql =
    getArg("--out-validation-sql") ?? path.resolve(workspaceRoot, "tmp/model-catalog-validation.sql");
  const limit = numberOrNull(getArg("--limit")) ?? 5;

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

  const [
    { data: models, error },
    { data: providers, error: providersError },
    { data: companies, error: companiesError },
    openrouterCatalog,
    metrikMap,
    inferenceLatencyMap,
    fallbackMap,
  ] = await Promise.all([
    supabase
      .from("models")
      .select("id, provider_id, name, slug, litellm_model_id"),
    supabase.from("providers").select("id, company_id, name, slug"),
    supabase.from("companies").select("id, name, logo_url, website"),
    fetchOpenRouterCatalog(),
    metrikPromise,
    inferenceLatencyPromise,
    loadFallbackData(),
  ]);

  if (error) throw error;
  if (providersError) throw providersError;
  if (companiesError) throw companiesError;

  const openrouterMap = openrouterCatalog.map;

  const updates = buildUpdates(models ?? [], openrouterMap, metrikMap, inferenceLatencyMap, fallbackMap);
  const existingProviderKeys = new Set((providers ?? []).map((p) => normalizeProviderKey(p.slug)));
  const existingCompanyNames = new Set((companies ?? []).map((c) => String(c.name ?? "").toLowerCase().trim()));

  const eligibleNewRows = [];
  for (const row of openrouterCatalog.rows) {
    const lookupKeys = [
      normalizeLookupKey(row.openrouter_id),
      normalizeLookupKey(row.slug),
      normalizeLookupKey(row.name),
      normalizeLookupKey(stripVersionSuffix(row.slug)),
      normalizeLookupKey(stripVersionSuffix(row.name)),
    ].filter(Boolean);
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
      for (const alias of providerAliasesFor(row.provider_key)) {
        providerPerf = inferenceLatencyMap.get(alias);
        if (providerPerf) break;
      }
    }
    const latency_ttft_ms = metrik?.latency_ttft_ms ?? providerPerf?.latency_ttft_ms ?? null;
    const throughput_tokens_per_sec =
      metrik?.throughput_tokens_per_sec ?? providerPerf?.throughput_tokens_per_sec ?? null;
    if (latency_ttft_ms == null || throughput_tokens_per_sec == null) continue;
    eligibleNewRows.push({
      ...row,
      latency_ttft_ms,
      throughput_tokens_per_sec,
      perf_source: mergeSources(["openrouter", metrik?.source, providerPerf?.source]),
    });
  }

  const dedupedEligible = dedupeBySlugKeepingHighestCompleteness(eligibleNewRows);
  const { selected, scoredCount } = selectTopCandidates(dedupedEligible, {
    limit,
    existingProviderKeys,
    existingCompanyNames,
  });
  const sql = `${buildCatalogUpsertSql(selected)}\n\n-- Existing row metadata updates for currently stored models.\n${buildUpdateSql(updates)}\n`;
  const validationSql = buildValidationSql(selected);

  await mkdir(path.dirname(outJson), { recursive: true });
  await mkdir(path.dirname(outSql), { recursive: true });
  await mkdir(path.dirname(outValidationSql), { recursive: true });
  await writeFile(
    outJson,
    JSON.stringify(
      {
        total_openrouter_rows: openrouterCatalog.rows.length,
        eligible_by_metrics_count: dedupedEligible.length,
        selected_for_write_count: selected.length,
        selected: selected.map((r) => ({
          slug: r.slug,
          name: r.name,
          provider_name: r.provider_name,
          company_name: r.company_name,
          completeness_score: r.completeness_score,
          completeness_fields: r.completeness_fields,
          existing_provider_company_match: r.existing_provider_company_match,
          selection_bucket: r.selection_bucket,
        })),
        existing_model_updates_count: updates.length,
        candidates_scored_count: scoredCount,
      },
      null,
      2
    )
  );
  await writeFile(outSql, sql);
  await writeFile(outValidationSql, validationSql);

  console.log(`Prepared catalog upserts for ${selected.length} models (limit=${limit}).`);
  console.log(`Prepared metadata updates for ${updates.length} existing model rows.`);
  console.log(`JSON: ${outJson}`);
  console.log(`SQL: ${outSql}`);
  console.log(`Validation SQL: ${outValidationSql}`);

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
