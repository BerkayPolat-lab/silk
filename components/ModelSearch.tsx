"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatContextTokens, formatLatencyMs, formatThroughputTps } from "@/lib/model-metadata-format";

// ── Provider utilities (exported for reuse) ───────────────────────────────────

export const PROVIDER_DOMAINS: Record<string, string> = {
  anthropic: "anthropic.com",
  openai: "openai.com",
  google: "google.com",
  meta: "meta.com",
  mistral: "mistral.ai",
  cohere: "cohere.com",
  deepseek: "deepseek.com",
  minimax: "minimax.io",
  stepfun: "stepfun.com",
  xai: "x.ai",
  together: "together.ai",
  groq: "groq.com",
  amazon: "amazon.com",
  microsoft: "microsoft.com",
  nvidia: "nvidia.com",
  "01.ai": "01.ai",
  alibaba: "alibaba.com",
  baidu: "baidu.com",
};

export function getProviderDomain(name: string): string | null {
  const n = name.toLowerCase().trim();
  if (PROVIDER_DOMAINS[n]) return PROVIDER_DOMAINS[n];
  for (const [key, domain] of Object.entries(PROVIDER_DOMAINS)) {
    if (n.includes(key)) return domain;
  }
  return null;
}

export function resolveProviderName(m: { providers: { name: string } | null }): string {
  if (!m.providers) return "—";
  return Array.isArray(m.providers)
    ? ((m.providers[0] as { name: string } | undefined)?.name ?? "—")
    : (m.providers as { name: string }).name;
}

export function ProviderLogo({
  name,
  logoUrl,
  size = 16,
  className = "",
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [errorCount, setErrorCount] = useState(0);
  const domain = getProviderDomain(name);

  // Build ordered fallback list: DB url first, then Clearbit
  const sources: string[] = [];
  if (logoUrl) sources.push(logoUrl);
  if (domain) sources.push(`https://logo.clearbit.com/${domain}`);

  const src = sources[errorCount] ?? null;
  if (!src) return null;

  return (
    // White background ensures dark-on-transparent logos (Anthropic, OpenAI) are
    // visible in both light and dark mode.
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        onError={() => setErrorCount((c) => c + 1)}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    </span>
  );
}

export function resolveLogoUrl(m: ModelSearchResult): string | null {
  const p = Array.isArray(m.providers)
    ? (m.providers[0] as { companies: { logo_url: string | null } | null } | undefined)
    : m.providers;
  return p?.companies?.logo_url ?? null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModelSearchResult = {
  id: string;
  name: string;
  slug: string;
  avg_rating: number | null;
  total_reviews: number | null;
  input_price_per_million_cents: number;
  output_price_per_million_cents: number;
  type_of_ai: string | null;
  parameters: string | null;
  gb_size: number | null;
  context_length_tokens: number | null;
  latency_ttft_ms: number | null;
  throughput_tokens_per_sec: number | null;
  perf_source: string | null;
  perf_updated_at: string | null;
  providers: {
    name: string;
    companies: { logo_url: string | null } | null;
  } | null;
};

type Filters = {
  query: string;
  minRating: string;
  minReviews: string;
  maxInputPrice: string;
  maxOutputPrice: string;
  maxLatencyMs: string;
  minThroughputTps: string;
  minContextLength: string;
};

// ── Filter sub-components ─────────────────────────────────────────────────────

function SegmentedPicker({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onMouseDown={(e) => e.preventDefault()} // keep popover open
          onClick={() => onChange(opt.value)}
          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-800 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StyledSelect({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-zinc-200 bg-white py-1.5 pl-3 pr-7 text-sm text-zinc-700 transition-colors focus:border-zinc-400 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:focus:border-zinc-500"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

// ── Filter sidebar ────────────────────────────────────────────────────────────

const RATING_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1★+", value: "1" },
  { label: "2★+", value: "2" },
  { label: "3★+", value: "3" },
  { label: "4★+", value: "4" },
  { label: "5★", value: "5" },
];

const REVIEW_OPTIONS = [
  { label: "Any", value: "" },
  { label: "1+", value: "1" },
  { label: "5+", value: "5" },
  { label: "10+", value: "10" },
  { label: "25+", value: "25" },
  { label: "50+", value: "50" },
];

const INPUT_PRICE_OPTIONS = [
  { label: "Any price", value: "" },
  { label: "≤ $0.50/1M", value: "50" },
  { label: "≤ $2/1M", value: "200" },
  { label: "≤ $5/1M", value: "500" },
  { label: "≤ $15/1M", value: "1500" },
  { label: "≤ $50/1M", value: "5000" },
];

const OUTPUT_PRICE_OPTIONS = [
  { label: "Any price", value: "" },
  { label: "≤ $0.50/1M", value: "50" },
  { label: "≤ $2/1M", value: "200" },
  { label: "≤ $5/1M", value: "500" },
  { label: "≤ $15/1M", value: "1500" },
  { label: "≤ $50/1M", value: "5000" },
];

const LATENCY_OPTIONS = [
  { label: "Any latency", value: "" },
  { label: "≤ 250 ms", value: "250" },
  { label: "≤ 500 ms", value: "500" },
  { label: "≤ 1,000 ms", value: "1000" },
  { label: "≤ 2,000 ms", value: "2000" },
];

const THROUGHPUT_OPTIONS = [
  { label: "Any throughput", value: "" },
  { label: "≥ 10 tok/s", value: "10" },
  { label: "≥ 25 tok/s", value: "25" },
  { label: "≥ 50 tok/s", value: "50" },
  { label: "≥ 100 tok/s", value: "100" },
];

const CONTEXT_OPTIONS = [
  { label: "Any context", value: "" },
  { label: "≥ 8k", value: "8000" },
  { label: "≥ 32k", value: "32000" },
  { label: "≥ 128k", value: "128000" },
  { label: "≥ 1M", value: "1000000" },
];

function FilterSidebar({
  filters,
  setFilter,
  onClearFilters,
  activeCount,
}: {
  filters: Filters;
  setFilter: <K extends keyof Filters>(k: K, v: Filters[K]) => void;
  onClearFilters: () => void;
  activeCount: number;
}) {
  return (
    <aside className="h-fit self-start rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Filters</h3>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Min rating
          </p>
          <SegmentedPicker
            options={RATING_OPTIONS}
            value={filters.minRating}
            onChange={(v) => setFilter("minRating", v)}
          />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Min reviews
          </p>
          <SegmentedPicker
            options={REVIEW_OPTIONS}
            value={filters.minReviews}
            onChange={(v) => setFilter("minReviews", v)}
          />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Max input price
          </p>
          <StyledSelect
            options={INPUT_PRICE_OPTIONS}
            value={filters.maxInputPrice}
            onChange={(v) => setFilter("maxInputPrice", v)}
          />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Max output price
          </p>
          <StyledSelect
            options={OUTPUT_PRICE_OPTIONS}
            value={filters.maxOutputPrice}
            onChange={(v) => setFilter("maxOutputPrice", v)}
          />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Max latency</p>
          <StyledSelect options={LATENCY_OPTIONS} value={filters.maxLatencyMs} onChange={(v) => setFilter("maxLatencyMs", v)} />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Min throughput
          </p>
          <StyledSelect
            options={THROUGHPUT_OPTIONS}
            value={filters.minThroughputTps}
            onChange={(v) => setFilter("minThroughputTps", v)}
          />
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Min context</p>
          <StyledSelect
            options={CONTEXT_OPTIONS}
            value={filters.minContextLength}
            onChange={(v) => setFilter("minContextLength", v)}
          />
        </div>
      </div>
    </aside>
  );
}

// ── Model card sub-components ─────────────────────────────────────────────────

function StarDisplay({ rating }: { rating: number }) {
  const rounded = Math.round(rating);
  return (
    <span className="flex items-center gap-px leading-none">
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`text-sm ${rounded >= star ? "text-amber-400" : "text-zinc-200 dark:text-zinc-700"}`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function PriceTag({ label, cents }: { label: string; cents: number }) {
  return (
    <span className="flex flex-col">
      <span className="text-xs text-zinc-400 dark:text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        ${(cents / 100).toFixed(4)}/1M
      </span>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ModelSearch() {
  const supabaseRef = useRef(createClient());
  const [filters, setFilters] = useState<Filters>({
    query: "",
    minRating: "",
    minReviews: "",
    maxInputPrice: "",
    maxOutputPrice: "",
    maxLatencyMs: "",
    minThroughputTps: "",
    minContextLength: "",
  });
  const [results, setResults] = useState<ModelSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function fetchResults(f: Filters) {
    setLoading(true);
    setError(null);

    let query = supabaseRef.current
      .from("models")
      .select(
        `id, name, slug, avg_rating, total_reviews,
         input_price_per_million_cents, output_price_per_million_cents,
         type_of_ai, parameters, gb_size,
         context_length_tokens, latency_ttft_ms, throughput_tokens_per_sec, perf_source, perf_updated_at,
         providers ( name, companies ( logo_url ) )`
      )
      .order("rank_order", { ascending: true, nullsFirst: false });

    if (f.query.trim()) query = query.ilike("name", `%${f.query.trim()}%`);
    if (f.minRating !== "") query = query.gte("avg_rating", Number(f.minRating));
    if (f.minReviews !== "") query = query.gte("total_reviews", Number(f.minReviews));
    if (f.maxInputPrice !== "") query = query.lte("input_price_per_million_cents", Number(f.maxInputPrice));
    if (f.maxOutputPrice !== "") query = query.lte("output_price_per_million_cents", Number(f.maxOutputPrice));
    if (f.maxLatencyMs !== "") query = query.lte("latency_ttft_ms", Number(f.maxLatencyMs));
    if (f.minThroughputTps !== "") query = query.gte("throughput_tokens_per_sec", Number(f.minThroughputTps));
    if (f.minContextLength !== "") query = query.gte("context_length_tokens", Number(f.minContextLength));

    const { data, error: supabaseError } = await query;
    if (supabaseError) {
      setError(supabaseError.message);
      setResults([]);
    } else {
      setResults((data ?? []) as unknown as ModelSearchResult[]);
    }
    setLoading(false);
  }

  // Debounced fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void fetchResults(filters), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters]);

  function clearFilters() {
    setFilters((prev) => ({
      ...prev,
      minRating: "",
      minReviews: "",
      maxInputPrice: "",
      maxOutputPrice: "",
      maxLatencyMs: "",
      minThroughputTps: "",
      minContextLength: "",
    }));
  }

  const activeFilterCount = [
    filters.minRating,
    filters.minReviews,
    filters.maxInputPrice,
    filters.maxOutputPrice,
    filters.maxLatencyMs,
    filters.minThroughputTps,
    filters.minContextLength,
  ].filter(Boolean).length;

  return (
    <div className="grid gap-4 lg:grid-cols-[280px,minmax(0,1fr)] lg:gap-6">
      <FilterSidebar
        filters={filters}
        setFilter={setFilter}
        onClearFilters={clearFilters}
        activeCount={activeFilterCount}
      />

      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 shadow-sm transition-colors dark:border-zinc-800 dark:bg-zinc-900">
          <svg
            className="h-4 w-4 shrink-0 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>

          <input
            type="text"
            value={filters.query}
            onChange={(e) => setFilter("query", e.target.value)}
            placeholder="Search models..."
            className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
          />

          {(filters.query || activeFilterCount > 0) && (
            <button
              type="button"
              onClick={() =>
                setFilters({
                  query: "",
                  minRating: "",
                  minReviews: "",
                  maxInputPrice: "",
                  maxOutputPrice: "",
                  maxLatencyMs: "",
                  minThroughputTps: "",
                  minContextLength: "",
                })
              }
              className="shrink-0 text-xs text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>

        <div className="text-xs text-zinc-400 dark:text-zinc-500">
          {loading ? (
            "Searching…"
          ) : error ? (
            <span className="text-red-500">{error}</span>
          ) : (
            `${results.length} ${results.length === 1 ? "model" : "models"} found`
          )}
        </div>

        {!loading && results.length === 0 && !error ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-6 py-10 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-400 dark:text-zinc-500">No models match your filters.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((model) => {
              const pName = resolveProviderName(model);
              const rating = model.avg_rating != null ? Number(model.avg_rating) : null;
              const reviewCount = model.total_reviews ?? 0;

              return (
                <Link
                  key={model.id}
                  href={`/models/${model.slug}`}
                  className="group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  {pName !== "—" && (
                    <div className="mb-2 flex items-center gap-1.5">
                      <ProviderLogo name={pName} logoUrl={resolveLogoUrl(model)} size={14} />
                      <p className="truncate text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                        {pName}
                      </p>
                    </div>
                  )}

                  <h3 className="mb-3 truncate text-sm font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-200">
                    {model.name}
                  </h3>

                  <div className="mb-3 flex items-center gap-2">
                    {rating !== null && rating > 0 ? (
                      <>
                        <StarDisplay rating={rating} />
                        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          {rating.toFixed(1)}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-zinc-300 dark:text-zinc-600">No ratings yet</span>
                    )}
                    {reviewCount > 0 && (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">({reviewCount})</span>
                    )}
                  </div>

                  <div className="mt-auto flex gap-4 pt-1">
                    <PriceTag label="Input" cents={model.input_price_per_million_cents} />
                    <PriceTag label="Output" cents={model.output_price_per_million_cents} />
                  </div>
                  <div className="mt-3 border-t border-zinc-100 pt-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <p>Latency: {formatLatencyMs(model.latency_ttft_ms)}</p>
                    <p>Throughput: {formatThroughputTps(model.throughput_tokens_per_sec)}</p>
                    <p>Context: {formatContextTokens(model.context_length_tokens)}</p>
                    {model.perf_source && <p>Source: {model.perf_source}</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
