"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ModelSearchResult } from "@/components/ModelSearch";
import { resolveLogoUrl, resolveProviderName, ProviderLogo } from "@/components/ModelSearch";
import { formatContextTokens, formatGbSize, formatLatencyMs, formatThroughputTps } from "@/lib/model-metadata-format";
import { createClient } from "@/lib/supabase/client";

type Direction = "higher" | "lower" | "none";

type CompareRow = {
  label: string;
  getValue: (m: ModelSearchResult) => string | number | null;
  format?: (v: string | number | null) => string;
  direction: Direction;
};

const ROWS: CompareRow[] = [
  { label: "Provider", getValue: resolveProviderName, direction: "none" },
  { label: "Type", getValue: (m) => m.type_of_ai, direction: "none" },
  { label: "Parameters", getValue: (m) => m.parameters, direction: "none" },
  { label: "Size", getValue: (m) => m.gb_size, format: (v) => formatGbSize(v == null ? null : Number(v)), direction: "none" },
  {
    label: "Latency (TTFT)",
    getValue: (m) => m.latency_ttft_ms,
    format: (v) => formatLatencyMs(v == null ? null : Number(v)),
    direction: "lower",
  },
  {
    label: "Throughput (tok/s)",
    getValue: (m) => m.throughput_tokens_per_sec,
    format: (v) => formatThroughputTps(v == null ? null : Number(v)),
    direction: "higher",
  },
  {
    label: "Context length",
    getValue: (m) => m.context_length_tokens,
    format: (v) => formatContextTokens(v == null ? null : Number(v)),
    direction: "higher",
  },
  {
    label: "Avg rating",
    getValue: (m) => m.avg_rating,
    format: (v) => (v == null || Number(v) === 0 ? "unknown" : Number(v).toFixed(1)),
    direction: "higher",
  },
  {
    label: "Reviews",
    getValue: (m) => m.total_reviews,
    format: (v) => (v == null ? "unknown" : String(v)),
    direction: "higher",
  },
  {
    label: "Input / 1M",
    getValue: (m) => m.input_price_per_million_cents,
    format: (v) => (v == null ? "unknown" : `$${(Number(v) / 100).toFixed(4)}`),
    direction: "lower",
  },
  {
    label: "Output / 1M",
    getValue: (m) => m.output_price_per_million_cents,
    format: (v) => (v == null ? "unknown" : `$${(Number(v) / 100).toFixed(4)}`),
    direction: "lower",
  },
];

function ModelColumnHeader({ model }: { model: ModelSearchResult }) {
  const provider = resolveProviderName(model);
  return (
    <div className="flex flex-col gap-0.5">
      {provider !== "—" && (
        <div className="flex items-center gap-1.5">
          <ProviderLogo name={provider} logoUrl={resolveLogoUrl(model)} size={14} />
          <span className="text-xs font-normal text-zinc-500">{provider}</span>
        </div>
      )}
      <span className="text-sm font-semibold text-zinc-900">{model.name}</span>
    </div>
  );
}

function CompareTable({ a, b }: { a: ModelSearchResult; b: ModelSearchResult }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-white">
            <th className="w-36 py-3.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Field
            </th>
            <th className="px-4 py-3 text-left">
              <ModelColumnHeader model={a} />
            </th>
            <th className="px-4 py-3 text-left">
              <ModelColumnHeader model={b} />
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => {
            const valA = row.getValue(a);
            const valB = row.getValue(b);
            const displayA = row.format ? row.format(valA) : (valA == null || valA === "" ? "unknown" : String(valA));
            const displayB = row.format ? row.format(valB) : (valB == null || valB === "" ? "unknown" : String(valB));

            if (displayA === "unknown" && displayB === "unknown") return null;

            let aWins = false;
            let bWins = false;
            if (row.direction !== "none" && valA != null && valB != null) {
              const nA = Number(valA);
              const nB = Number(valB);
              if (!isNaN(nA) && !isNaN(nB) && nA !== nB) {
                aWins = row.direction === "higher" ? nA > nB : nA < nB;
                bWins = row.direction === "higher" ? nB > nA : nB < nA;
              }
            }

            return (
              <tr key={row.label} className="border-b border-zinc-200 bg-white last:border-0">
                <td className="whitespace-nowrap py-3 pl-4 pr-3 text-xs font-medium text-zinc-500">{row.label}</td>
                <td className={`px-4 py-3 ${aWins ? "font-semibold text-emerald-600" : "text-zinc-700"}`}>
                  {displayA}
                </td>
                <td className={`px-4 py-3 ${bWins ? "font-semibold text-emerald-600" : "text-zinc-700"}`}>
                  {displayB}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ModelCombobox({
  models,
  value,
  onChange,
  exclude,
  placeholder,
}: {
  models: ModelSearchResult[];
  value: string;
  onChange: (id: string) => void;
  exclude: string;
  placeholder: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedModel = models.find((m) => m.id === value) ?? null;

  const filtered = models.filter((m) => {
    if (m.id === exclude) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    const provider = resolveProviderName(m).toLowerCase();
    return m.name.toLowerCase().includes(q) || provider.includes(q);
  });

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function select(model: ModelSearchResult) {
    onChange(model.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        return;
      }
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) select(filtered[activeIndex]);
        break;
      case "Escape":
        setOpen(false);
        setQuery("");
        inputRef.current?.blur();
        break;
    }
  }

  const displayValue = open ? query : (selectedModel?.name ?? "");

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex cursor-text items-center gap-2 rounded-xl border bg-white px-3 py-2.5 transition-colors ${
          open ? "border-zinc-500" : selectedModel ? "border-zinc-600 hover:border-zinc-500" : "border-zinc-800 hover:border-zinc-700"
        }`}
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selectedModel && !open && (
          <ProviderLogo name={resolveProviderName(selectedModel)} logoUrl={resolveLogoUrl(selectedModel)} size={16} className="shrink-0" />
        )}

        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-500"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-autocomplete="list"
        />

        {value && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="shrink-0 rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-400"
            aria-label="Clear selection"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        <svg
          className={`h-4 w-4 shrink-0 text-zinc-600 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-xl"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-sm text-zinc-500">No models found.</li>
          ) : (
            filtered.map((model, idx) => {
              const provider = resolveProviderName(model);
              const isActive = idx === activeIndex;
              const isSelected = model.id === value;
              return (
                <li
                  key={model.id}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => select(model)}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
                    isActive ? "bg-zinc-100" : ""
                  } ${isSelected ? "opacity-40" : ""}`}
                >
                  <ProviderLogo name={provider} logoUrl={resolveLogoUrl(model)} size={18} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    {provider !== "—" && <p className="truncate text-xs text-zinc-500">{provider}</p>}
                    <p className="truncate text-sm font-medium text-zinc-900">{model.name}</p>
                  </div>
                  {isSelected && (
                    <svg className="h-4 w-4 shrink-0 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

export default function CompareModelsPanel() {
  const supabaseRef = useRef(createClient());
  const [allModels, setAllModels] = useState<ModelSearchResult[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [selectedA, setSelectedA] = useState("");
  const [selectedB, setSelectedB] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabaseRef.current
        .from("models")
        .select(
          `id, name, slug, avg_rating, total_reviews,
           input_price_per_million_cents, output_price_per_million_cents,
           type_of_ai, parameters, gb_size,
           context_length_tokens, latency_ttft_ms, throughput_tokens_per_sec, perf_source, perf_updated_at,
           providers ( name, companies ( logo_url ) )`
        )
        .order("rank_order", { ascending: true, nullsFirst: false });
      setAllModels((data ?? []) as unknown as ModelSearchResult[]);
      setLoadingModels(false);
    })();
  }, []);

  const modelA = allModels.find((m) => m.id === selectedA) ?? null;
  const modelB = allModels.find((m) => m.id === selectedB) ?? null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="mb-5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Compare Models</h2>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Search and select two models to see a side-by-side breakdown.
        </p>
      </div>

      {loadingModels ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading models…</p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                { label: "Model A", value: selectedA, onChange: setSelectedA, exclude: selectedB },
                { label: "Model B", value: selectedB, onChange: setSelectedB, exclude: selectedA },
              ] as const
            ).map(({ label, value, onChange, exclude }) => (
              <div key={label}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{label}</p>
                <ModelCombobox
                  models={allModels}
                  value={value}
                  onChange={onChange}
                  exclude={exclude}
                  placeholder="search for model"
                />
              </div>
            ))}
          </div>

          {modelA && modelB ? (
            <CompareTable a={modelA} b={modelB} />
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">
                {!modelA && !modelB
                  ? "Search and select a model for each slot above."
                  : "Select one more model to see the comparison."}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
