"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { MarketShareAuthorRow } from "@/lib/analytics/model-author";
import type { AnalyticsOverview, AnalyticsTopRow } from "@/lib/analytics/usage";

type WindowKey = "daily" | "weekly" | "monthly";

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatUsdCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function rankBarWidth(value: number, maxValue: number): string {
  if (maxValue <= 0) return "0%";
  return `${Math.max(6, Math.round((value / maxValue) * 100))}%`;
}

/** Market-leader palette from reference UI (bright blue … magenta “Others”). */
const BAR_BY_PROVIDER = {
  google: "#1a73e8",
  anthropic: "#14b8a6",
  openai: "#f5a524",
  qwen: "#5f7eae",
  minimax: "#22bb5c",
  deepseek: "#ff7c33",
  zAi: "#f4a7c1",
  xiaomi: "#aabe2e",
  nvidia: "#1d6f42",
  others: "#e879f9",
} as const;

const PROVIDER_BAR_RULES: ReadonlyArray<{ test: RegExp; color: string }> = [
  { test: /(^|[\s/_-])(goog|gemini)|\bgemini\b|\bpalm\b/, color: BAR_BY_PROVIDER.google },
  { test: /anthropic|^claude|[-_]claude| claude\b/, color: BAR_BY_PROVIDER.anthropic },
  {
    test: /\bgpt[-_]|chatgpt|^gpt\b|[-_]gpt|openai|o\d[-_]?mini|^o\d\b|[-_]openai\b/,
    color: BAR_BY_PROVIDER.openai,
  },
  { test: /\bqwen\b|tongyi/, color: BAR_BY_PROVIDER.qwen },
  { test: /minimax|ababa/, color: BAR_BY_PROVIDER.minimax },
  { test: /deepseek/, color: BAR_BY_PROVIDER.deepseek },
  { test: /\bz[-_]?ai\b|\bglm[-_]|chatglm|zhipu|^glm\b/, color: BAR_BY_PROVIDER.zAi },
  { test: /xiaomi|\bmimo\b/, color: BAR_BY_PROVIDER.xiaomi },
  { test: /nvidia|nemotron/, color: BAR_BY_PROVIDER.nvidia },
];

function stableStringHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(31, h) + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Fallback hues when slug/name doesn’t match a known provider (avoids clashes with BAR_BY_PROVIDER). */
const BAR_FALLBACK = ["#64748b", "#8b5cf6", "#0ea5e9", "#eab308"];

function LegendColumn({ rows, startRank }: { rows: MarketShareAuthorRow[]; startRank: number }) {
  return (
    <ul className="space-y-4 md:space-y-5">
      {rows.map((row, idx) => (
        <li key={row.key} className="flex items-center justify-between gap-4 md:gap-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-3.5">
            <span className="shrink-0 tabular-nums text-sm font-medium text-zinc-500 dark:text-zinc-400">{startRank + idx}.</span>
            <span className="size-3 shrink-0 rounded-full ring-2 ring-black/5 ring-offset-2 ring-offset-white dark:ring-white/15 dark:ring-offset-zinc-900" style={{ backgroundColor: row.color }} />
            <span className="min-w-0 truncate text-base font-semibold text-zinc-900 dark:text-zinc-50 md:text-[1.0625rem]">{row.label}</span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 tabular-nums">
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50 md:text-lg">{formatCompactNumber(row.totalTokens)}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400 md:text-sm">{row.sharePercent.toFixed(1)}%</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function rankBarColor(row: AnalyticsTopRow): string {
  const name = row.modelName.trim().toLowerCase();
  if (name === "others" || name === "other") {
    return BAR_BY_PROVIDER.others;
  }

  const haystack = `${row.modelSlug ?? ""} ${row.modelName}`.toLowerCase();
  for (const { test, color } of PROVIDER_BAR_RULES) {
    if (test.test(haystack)) return color;
  }

  const key = row.modelSlug ?? row.modelId;
  return BAR_FALLBACK[stableStringHash(key) % BAR_FALLBACK.length];
}

function RankedRows({
  rows,
  valueLabel,
  valueAccessor,
}: {
  rows: AnalyticsTopRow[];
  valueLabel: string;
  valueAccessor: (row: AnalyticsTopRow) => number;
}) {
  const maxValue = rows.length > 0 ? Math.max(...rows.map(valueAccessor)) : 0;

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => {
        const value = valueAccessor(row);
        const width = rankBarWidth(value, maxValue);
        return (
          <div key={row.modelId} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  <span className="mr-2 text-zinc-500">#{idx + 1}</span>
                  {row.modelSlug ? (
                    <Link href={`/models/${row.modelSlug}`} className="hover:underline">
                      {row.modelName}
                    </Link>
                  ) : (
                    row.modelName
                  )}
                </p>
              </div>
              <p className="shrink-0 text-xs text-zinc-600 dark:text-zinc-300">
                {valueLabel}: <span className="font-semibold">{formatCompactNumber(value)}</span>
              </p>
            </div>
            <div className="h-2 w-full rounded bg-zinc-100 dark:bg-zinc-800">
              <div className="h-2 rounded" style={{ width, backgroundColor: rankBarColor(row) }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <span>{formatUsdCents(row.spendCents)}</span>
              <span>{formatCompactNumber(row.requests)} req</span>
            </div>
          </div>
        );
      })}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          No usage data yet.
        </div>
      ) : null}
    </div>
  );
}

export default function AnalyticsClient({ overview }: { overview: AnalyticsOverview }) {
  const [activeWindow, setActiveWindow] = useState<WindowKey>("weekly");

  const windowRows = useMemo(() => {
    if (activeWindow === "daily") return overview.usageByWindow.dailyTop;
    if (activeWindow === "monthly") return overview.usageByWindow.monthlyTop;
    return overview.usageByWindow.weeklyTop;
  }, [activeWindow, overview.usageByWindow.dailyTop, overview.usageByWindow.monthlyTop, overview.usageByWindow.weeklyTop]);

  const { marketShare } = overview;
  const stackKeys = marketShare.stackKeys;
  const legendLeft = marketShare.authors.slice(0, Math.ceil(marketShare.authors.length / 2));
  const legendRight = marketShare.authors.slice(Math.ceil(marketShare.authors.length / 2));

  const segmentColorLookup = useMemo(
    () => Object.fromEntries(marketShare.authors.map((r) => [r.key, r.color])),
    [marketShare.authors]
  );

  const authorLabelLookup = useMemo(
    () => Object.fromEntries(marketShare.authors.map((r) => [r.key, r.label])),
    [marketShare.authors]
  );

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-lg font-semibold tabular-nums">{formatUsdCents(overview.summary.totalSpendCents)}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total spend</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-lg font-semibold tabular-nums">{formatCompactNumber(overview.summary.totalTokens)}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total tokens</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-lg font-semibold tabular-nums">{formatCompactNumber(overview.summary.totalRequests)}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total requests</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-lg font-semibold tabular-nums">{formatCompactNumber(overview.summary.activeModels)}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Active models</p>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex justify-end">
          <div className="inline-flex rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
            {(["daily", "weekly", "monthly"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveWindow(key)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  activeWindow === key
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <h2 className="mb-3 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">Top 10 Models by Spend</h2>
            <RankedRows rows={overview.topBySpend} valueLabel="Spend rank" valueAccessor={(row) => row.spendCents} />
          </div>

          <div className="min-w-0">
            <h2 className="mb-3 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">Most Used by Tokens</h2>
            <RankedRows rows={windowRows} valueLabel="Tokens" valueAccessor={(row) => row.tokens} />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Market share</h2>

        {marketShare.windowTotalTokens > 0 && stackKeys.length > 0 ? (
          <div className="flex gap-2">
            <div className="flex h-52 w-7 shrink-0 flex-col justify-between py-1 text-right font-mono text-[10px] leading-none text-zinc-400">
              <span>100%</span>
              <span>60%</span>
              <span>30%</span>
              <span>0%</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex h-52 gap-px">
                {marketShare.daily.map((day) => {
                  const tooltipParts = stackKeys.map(
                    (key) => `${authorLabelLookup[key] ?? key}: ${day.pctByAuthor[key]?.toFixed(0) ?? 0}%`
                  );
                  const tooltip = `${day.date} · ${tooltipParts.join("; ")}`;
                  return (
                    <div
                      key={day.date}
                      className="group relative h-full min-h-0 min-w-[2px] flex-1 overflow-hidden rounded-[1px]"
                      title={tooltip}
                    >
                      {(() => {
                        let offsetBottom = 0;
                        return stackKeys.map((key) => {
                          const pct = day.pctByAuthor[key] ?? 0;
                          const bg = segmentColorLookup[key] ?? BAR_FALLBACK[stableStringHash(key) % BAR_FALLBACK.length];
                          const bottom = offsetBottom;
                          offsetBottom += pct;
                          return (
                            <div
                              key={key}
                              className="absolute left-0 right-0 transition-opacity group-hover:opacity-90"
                              style={{
                                bottom: `${bottom}%`,
                                height: `${pct}%`,
                                backgroundColor: bg,
                              }}
                            />
                          );
                        });
                      })()}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px] text-zinc-400">
                <span>{marketShare.daily[0]?.date ?? "—"}</span>
                <span>{marketShare.daily[marketShare.daily.length - 1]?.date ?? "—"}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-52 flex-col justify-center px-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No token usage recorded in this window yet. Usage will appear here as segmented columns (share by author per day),
            mirroring{" "}
            <a href="https://openrouter.ai/rankings" className="underline underline-offset-2" target="_blank" rel="noreferrer noopener">
              OpenRouter’s market-share view
            </a>
            .
          </div>
        )}

        {marketShare.authors.length > 0 ? (
          <>
            <h3 className="sr-only">Author rankings</h3>
            <div className="grid gap-x-14 gap-y-6 md:grid-cols-2">
              <LegendColumn rows={legendLeft} startRank={1} />
              <LegendColumn rows={legendRight} startRank={legendLeft.length + 1} />
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
