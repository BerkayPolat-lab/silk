import { createServiceRoleClient } from "@/lib/supabase/service";

type ModelRow = {
  id: string;
  name: string;
  slug: string;
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
};

function asModel(models: UsageEventRow["models"]): ModelRow | null {
  if (!models) return null;
  return Array.isArray(models) ? (models[0] ?? null) : models;
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
        slug
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
    }
  }

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
  };
}
