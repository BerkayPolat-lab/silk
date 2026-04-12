"use client";

import { useEffect, useRef, useState } from "react";
import ModelSearch, {
  type ModelSearchResult,
  resolveProviderName,
  resolveLogoUrl,
  ProviderLogo,
} from "@/components/ModelSearch";
import { createClient } from "@/lib/supabase/client";

// ── Comparison config ─────────────────────────────────────────────────────────

type Direction = "higher" | "lower" | "none";

type CompareRow = {
  label: string;
  getValue: (m: ModelSearchResult) => string | number | null;
  format?: (v: string | number | null) => string;
  direction: Direction;
};

const ROWS: CompareRow[] = [
  { label: "Provider",     getValue: resolveProviderName,                                                         direction: "none"   },
  { label: "Type",         getValue: (m) => m.type_of_ai,                                                         direction: "none"   },
  { label: "Parameters",   getValue: (m) => m.parameters,                                                         direction: "none"   },
  { label: "Layers",       getValue: (m) => m.layers,        format: (v) => v == null ? "—" : String(v),          direction: "none"   },
  { label: "Size",         getValue: (m) => m.gb_size,       format: (v) => v == null ? "—" : `${Number(v).toFixed(1)} GB`,           direction: "none"   },
  { label: "Avg rating",   getValue: (m) => m.avg_rating,    format: (v) => (v == null || Number(v) === 0 ? "—" : Number(v).toFixed(1)), direction: "higher" },
  { label: "Reviews",      getValue: (m) => m.total_reviews, format: (v) => v == null ? "—" : String(v),          direction: "higher" },
  { label: "Input / 1M",   getValue: (m) => m.input_price_per_million_cents,  format: (v) => v == null ? "—" : `$${(Number(v) / 100).toFixed(4)}`, direction: "lower" },
  { label: "Output / 1M",  getValue: (m) => m.output_price_per_million_cents, format: (v) => v == null ? "—" : `$${(Number(v) / 100).toFixed(4)}`, direction: "lower" },
];

// ── Comparison table ──────────────────────────────────────────────────────────

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
      <span className="text-sm font-semibold text-zinc-100">{model.name}</span>
    </div>
  );
}

function CompareTable({ a, b }: { a: ModelSearchResult; b: ModelSearchResult }) {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900">
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
            const displayA = row.format ? row.format(valA) : (valA == null || valA === "" ? "—" : String(valA));
            const displayB = row.format ? row.format(valB) : (valB == null || valB === "" ? "—" : String(valB));

            // Hide rows where neither model has real data
            if (displayA === "—" && displayB === "—") return null;

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
              <tr key={row.label} className="border-b border-zinc-800 bg-zinc-900 last:border-0">
                <td className="whitespace-nowrap py-3 pl-4 pr-3 text-xs font-medium text-zinc-500">
                  {row.label}
                </td>
                <td className={`px-4 py-3 ${aWins ? "font-semibold text-emerald-400" : "text-zinc-300"}`}>
                  {displayA}
                  {aWins && <span className="ml-1 text-xs text-emerald-500">▲</span>}
                </td>
                <td className={`px-4 py-3 ${bWins ? "font-semibold text-emerald-400" : "text-zinc-300"}`}>
                  {displayB}
                  {bWins && <span className="ml-1 text-xs text-emerald-500">▲</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Model combobox ────────────────────────────────────────────────────────────

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

  const selectedModel = models.find((m) => m.id === value) ?? null;

  const filtered = models.filter((m) => {
    if (m.id === exclude) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    const provider = resolveProviderName(m).toLowerCase();
    return m.name.toLowerCase().includes(q) || provider.includes(q);
  });

  // Close on outside click
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

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Scroll active item into view
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
      {/* Input box */}
      <div
        className={`flex cursor-text items-center gap-2 rounded-xl border bg-zinc-900 px-3 py-2.5 transition-colors ${
          open
            ? "border-zinc-500"
            : selectedModel
            ? "border-zinc-600 hover:border-zinc-500"
            : "border-zinc-800 hover:border-zinc-700"
        }`}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {/* Logo of selected model (shown when closed) */}
        {selectedModel && !open && (
          <ProviderLogo name={resolveProviderName(selectedModel)} logoUrl={resolveLogoUrl(selectedModel)} size={16} className="shrink-0" />
        )}

        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
        />

        {/* Clear */}
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

        {/* Chevron */}
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

      {/* Dropdown list */}
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
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
                    isActive ? "bg-zinc-800/70" : ""
                  } ${isSelected ? "opacity-40" : ""}`}
                >
                  <ProviderLogo name={provider} logoUrl={resolveLogoUrl(model)} size={18} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    {provider !== "—" && (
                      <p className="truncate text-xs text-zinc-500">{provider}</p>
                    )}
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {model.name}
                    </p>
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

// ── Compare panel ─────────────────────────────────────────────────────────────

function ComparePanel({ onClose }: { onClose: () => void }) {
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
           type_of_ai, parameters, layers, gb_size,
           providers ( name, companies ( logo_url ) )`
        )
        .order("rank_order", { ascending: true, nullsFirst: false });
      setAllModels((data ?? []) as ModelSearchResult[]);
      setLoadingModels(false);
    })();
  }, []);

  const modelA = allModels.find((m) => m.id === selectedA) ?? null;
  const modelB = allModels.find((m) => m.id === selectedB) ?? null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Compare Models</h2>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Search and select two models to see a side-by-side breakdown.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close compare panel"
          className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loadingModels ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading models…</p>
      ) : (
        <>
          {/* Comboboxes */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                { label: "Model A", value: selectedA, onChange: setSelectedA, exclude: selectedB },
                { label: "Model B", value: selectedB, onChange: setSelectedB, exclude: selectedA },
              ] as const
            ).map(({ label, value, onChange, exclude }) => (
              <div key={label}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  {label}
                </p>
                <ModelCombobox
                  models={allModels}
                  value={value}
                  onChange={onChange}
                  exclude={exclude}
                  placeholder={`Search for ${label.toLowerCase()}…`}
                />
              </div>
            ))}
          </div>

          {/* Table or placeholder */}
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

// ── Main export ───────────────────────────────────────────────────────────────

export default function MarketplaceClient() {
  const [compareOpen, setCompareOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Browse and filter models below.</p>
        <button
          type="button"
          onClick={() => setCompareOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            compareOpen
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
          }`}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Compare Models
        </button>
      </div>

      {compareOpen && <ComparePanel onClose={() => setCompareOpen(false)} />}

      <ModelSearch />
    </div>
  );
}
