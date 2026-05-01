import { createServiceRoleClient } from "@/lib/supabase/service";

import type { AnalyticsMarketShare, MarketShareAuthorRow } from "@/lib/analytics/model-author";
import {
  MARKET_SHARE_TOP_K,
  authorColor,
  displayAuthorLabel,
  resolveModelAuthorKey,
} from "@/lib/analytics/model-author";

type ProviderRow = { slug: string; name: string };

type ModelRow = {
  id: string;
  name: string;
  slug: string;
  providers?: ProviderRow | ProviderRow[] | null;
};

type UsageEventRow = {
  model_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_cents: number;
  rollup_request_count: number | null;
  created_at: string;
  models: ModelRow | ModelRow[] | null;
};

export type AnalyticsTopRow = {
  modelId: string;
  modelName: string;
  modelSlug: string | null;
  spendCents: number;
  tokens: number;
  requests: number;
};

export type AnalyticsSummary = {
  totalSpendCents: number;
  totalTokens: number;
  totalRequests: number;
  activeModels: number;
};

export type AnalyticsTimePoint = {
  date: string;
  spendCents: number;
  tokens: number;
  requests: number;
};

export type AnalyticsOverview = {
  summary: AnalyticsSummary;
  topBySpend: AnalyticsTopRow[];
  usageByWindow: {
    dailyTop: AnalyticsTopRow[];
    weeklyTop: AnalyticsTopRow[];
    monthlyTop: AnalyticsTopRow[];
  };
  timeseries: AnalyticsTimePoint[];
  marketShare: AnalyticsMarketShare;
};

function asModel(models: UsageEventRow["models"]): ModelRow | null {
  if (!models) return null;
  return Array.isArray(models) ? (models[0] ?? null) : models;
}

function providerSlugFromModel(model: ModelRow | null): string | null {
  if (!model?.providers) return null;
  const p = Array.isArray(model.providers) ? model.providers[0] : model.providers;
  return p?.slug ?? null;
}

/** Largest remainder so daily shares sum to 100 integers. */
function roundSharesTo100(keys: string[], rawParts: Record<string, number>): Record<string, number> {
  const total = keys.reduce((s, k) => s + Math.max(0, rawParts[k] ?? 0), 0);
  if (total <= 0) return Object.fromEntries(keys.map((k) => [k, 0]));

  const quotas = keys.map((k) => ({
    key: k,
    w: rawParts[k] ?? 0,
    floor: Math.floor(((rawParts[k] ?? 0) / total) * 100),
    frac: ((rawParts[k] ?? 0) / total) * 100 - Math.floor(((rawParts[k] ?? 0) / total) * 100),
  }));
  const sumFloor = quotas.reduce((s, q) => s + q.floor, 0);
  let leftover = 100 - sumFloor;
  quotas.sort((a, b) => b.frac - a.frac);
  let i = 0;
  while (leftover > 0 && i < quotas.length) {
    quotas[i].floor += 1;
    leftover -= 1;
    i += 1;
  }
  const out: Record<string, number> = {};
  for (const q of quotas) out[q.key] = q.floor;
  return out;
}

function buildMarketShare(args: {
  timeseriesDates: string[];
  perDayAuthorTokens: Map<string, Map<string, number>>;
}): AnalyticsMarketShare {
  const empty: AnalyticsMarketShare = {
    authors: [],
    stackKeys: [],
    daily: args.timeseriesDates.map((date) => ({ date, pctByAuthor: {} })),
    windowTotalTokens: 0,
  };

  const windowTotalsByAuthor = new Map<string, number>();
  let windowGrand = 0;

  for (const date of args.timeseriesDates) {
    const dayMap = args.perDayAuthorTokens.get(date);
    if (!dayMap) continue;
    for (const [auth, tk] of dayMap.entries()) {
      windowTotalsByAuthor.set(auth, (windowTotalsByAuthor.get(auth) ?? 0) + tk);
      windowGrand += tk;
    }
  }

  if (windowGrand <= 0) return empty;

  const ranked = [...windowTotalsByAuthor.entries()].sort((a, b) => b[1] - a[1]);

  const topSlots = MARKET_SHARE_TOP_K;
  const chosenTop = ranked.slice(0, Math.min(topSlots, ranked.length)).map(([k]) => k);
  const topSet = new Set(chosenTop);
  const othersAccum = ranked.slice(topSlots).reduce((s, [, v]) => s + v, 0);
  const hasOthers = othersAccum > 0 && ranked.length > topSlots;

  const authors: MarketShareAuthorRow[] = chosenTop.map((key) => {
    const tk = windowTotalsByAuthor.get(key) ?? 0;
    return {
      key,
      label: displayAuthorLabel(key),
      color: authorColor(key),
      totalTokens: tk,
      sharePercent: (tk / windowGrand) * 100,
    };
  });

  if (hasOthers) {
    authors.push({
      key: "others",
      label: displayAuthorLabel("others"),
      color: authorColor("others"),
      totalTokens: othersAccum,
      sharePercent: (othersAccum / windowGrand) * 100,
    });
  }

  const nonOthers = chosenTop.slice();
  nonOthers.sort((a, b) => (windowTotalsByAuthor.get(b) ?? 0) - (windowTotalsByAuthor.get(a) ?? 0));
  const stackKeys = hasOthers ? [...nonOthers, "others"] : nonOthers;

  const daily = args.timeseriesDates.map((date) => {
    const dayMap = args.perDayAuthorTokens.get(date) ?? new Map();
    const rollup: Record<string, number> = {};

    if (hasOthers) {
      for (const [auth, tk] of dayMap.entries()) {
        const target = topSet.has(auth) ? auth : "others";
        rollup[target] = (rollup[target] ?? 0) + tk;
      }
    } else {
      for (const [auth, tk] of dayMap.entries()) {
        rollup[auth] = (rollup[auth] ?? 0) + tk;
      }
    }

    const raw: Record<string, number> = {};
    let subsetSum = 0;
    for (const k of stackKeys) {
      const v = rollup[k] ?? 0;
      raw[k] = v;
      subsetSum += v;
    }

    if (subsetSum <= 0) {
      return { date, pctByAuthor: Object.fromEntries(stackKeys.map((k) => [k, 0])) };
    }

    return { date, pctByAuthor: roundSharesTo100(stackKeys, raw) };
  });

  return {
    authors,
    stackKeys,
    daily,
    windowTotalTokens: windowGrand,
  };
}

function toDateKey(dateStr: string): string {
  return dateStr.slice(0, 10);
}

function buildEmptyTimeseries(days: number, end = new Date()): AnalyticsTimePoint[] {
  const rows: AnalyticsTimePoint[] = [];
  const d = new Date(end);
  d.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const point = new Date(d);
    point.setDate(point.getDate() - i);
    rows.push({
      date: point.toISOString().slice(0, 10),
      spendCents: 0,
      tokens: 0,
      requests: 0,
    });
  }
  return rows;
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("api_usage_events")
    .select(
      `
      model_id,
      prompt_tokens,
      completion_tokens,
      cost_cents,
      rollup_request_count,
      created_at,
      models (
        id,
        name,
        slug,
        providers (
          slug,
          name
        )
      )
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch analytics: ${error.message}`);
  }

  const rows = (data ?? []) as UsageEventRow[];

  const perModelAll = new Map<string, AnalyticsTopRow>();
  const perModelDaily = new Map<string, AnalyticsTopRow>();
  const perModelWeekly = new Map<string, AnalyticsTopRow>();
  const perModelMonthly = new Map<string, AnalyticsTopRow>();
  const timeseries = buildEmptyTimeseries(30);
  const timeseriesIndex = new Map(timeseries.map((row) => [row.date, row]));

  const perDayAuthorTokens = new Map<string, Map<string, number>>();
  for (const t of timeseries) {
    perDayAuthorTokens.set(t.date, new Map());
  }

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

  let totalSpendCents = 0;
  let totalTokens = 0;
  let totalRequests = 0;

  const upsert = (
    target: Map<string, AnalyticsTopRow>,
    row: UsageEventRow,
    tokens: number,
    requests: number,
    spendCents: number
  ) => {
    const model = asModel(row.models);
    const existing = target.get(row.model_id);
    if (!existing) {
      target.set(row.model_id, {
        modelId: row.model_id,
        modelName: model?.name ?? "Unknown model",
        modelSlug: model?.slug ?? null,
        spendCents,
        tokens,
        requests,
      });
      return;
    }
    existing.spendCents += spendCents;
    existing.tokens += tokens;
    existing.requests += requests;
  };

  for (const row of rows) {
    const prompt = Math.max(0, Number(row.prompt_tokens ?? 0));
    const completion = Math.max(0, Number(row.completion_tokens ?? 0));
    const tokens = prompt + completion;
    const requests = Math.max(1, Number(row.rollup_request_count ?? 1));
    const spendCents = Math.max(0, Number(row.cost_cents ?? 0));
    const eventMs = new Date(row.created_at).getTime();

    totalSpendCents += spendCents;
    totalTokens += tokens;
    totalRequests += requests;

    upsert(perModelAll, row, tokens, requests, spendCents);

    if (eventMs >= dayAgo) {
      upsert(perModelDaily, row, tokens, requests, spendCents);
    }
    if (eventMs >= weekAgo) {
      upsert(perModelWeekly, row, tokens, requests, spendCents);
    }
    if (eventMs >= monthAgo) {
      upsert(perModelMonthly, row, tokens, requests, spendCents);
    }

    const dayKey = toDateKey(row.created_at);
    const bucket = timeseriesIndex.get(dayKey);
    if (bucket) {
      bucket.spendCents += spendCents;
      bucket.tokens += tokens;
      bucket.requests += requests;

      const model = asModel(row.models);
      const authorKey = resolveModelAuthorKey(
        providerSlugFromModel(model),
        model?.slug ?? null,
        model?.name ?? ""
      );
      const dayAuthors = perDayAuthorTokens.get(dayKey);
      if (dayAuthors) {
        dayAuthors.set(authorKey, (dayAuthors.get(authorKey) ?? 0) + tokens);
      }
    }
  }

  const weeklyTimeseries = timeseries.slice(-7);
  const marketShare = buildMarketShare({
    timeseriesDates: weeklyTimeseries.map((t) => t.date),
    perDayAuthorTokens,
  });

  const bySpendDesc = (a: AnalyticsTopRow, b: AnalyticsTopRow) => b.spendCents - a.spendCents;
  const byTokensDesc = (a: AnalyticsTopRow, b: AnalyticsTopRow) => b.tokens - a.tokens;

  return {
    summary: {
      totalSpendCents,
      totalTokens,
      totalRequests,
      activeModels: perModelAll.size,
    },
    topBySpend: [...perModelAll.values()].sort(bySpendDesc).slice(0, 10),
    usageByWindow: {
      dailyTop: [...perModelDaily.values()].sort(byTokensDesc).slice(0, 10),
      weeklyTop: [...perModelWeekly.values()].sort(byTokensDesc).slice(0, 10),
      monthlyTop: [...perModelMonthly.values()].sort(byTokensDesc).slice(0, 10),
    },
    timeseries,
    marketShare,
  };
}
