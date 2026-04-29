"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
              <div className="h-2 rounded bg-blue-500" style={{ width }} />
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

  const timeseriesMaxTokens =
    overview.timeseries.length > 0 ? Math.max(...overview.timeseries.map((row) => row.tokens)) : 0;

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

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">Top 10 Models by Spend</h2>
          <RankedRows rows={overview.topBySpend} valueLabel="Spend rank" valueAccessor={(row) => row.spendCents} />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Most Used by Tokens</h2>
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

          <RankedRows rows={windowRows} valueLabel="Tokens" valueAccessor={(row) => row.tokens} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-900 dark:text-zinc-100">Last 30 Days Token Usage</h2>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex h-40 items-end gap-1">
            {overview.timeseries.map((point) => {
              const h = timeseriesMaxTokens > 0 ? Math.max(3, Math.round((point.tokens / timeseriesMaxTokens) * 100)) : 0;
              return (
                <div key={point.date} className="group flex-1" title={`${point.date}: ${formatCompactNumber(point.tokens)} tokens`}>
                  <div className="w-full rounded-t bg-emerald-500/80 transition-opacity group-hover:opacity-100" style={{ height: `${h}%` }} />
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span>{overview.timeseries[0]?.date ?? "-"}</span>
            <span>{overview.timeseries[overview.timeseries.length - 1]?.date ?? "-"}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
