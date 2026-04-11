import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Model } from "@/types";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: models } = await supabase
    .from("models")
    .select(
      `
      id,
      name,
      slug,
      highlights,
      rank_order,
      avg_rating,
      total_reviews,
      providers (
        id,
        name,
        slug,
        avg_rating,
        companies (name)
      )
    `
    )
    .order("rank_order", { ascending: true });

  const modelList = (models ?? []) as unknown as Model[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold tracking-tight">
          LLM API Marketplace
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Find the perfect API for your needs. Compare models, pricing, and
          capabilities from top providers.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modelList.map((model) => {
          const provider = model.providers as (Model["providers"] & { id?: string }) | null;
          const company = provider?.companies as { name?: string } | null;
          return (
            <div
              key={model.id}
              className="group rounded-xl border border-zinc-200 bg-white shadow-sm transition hover:border-zinc-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <Link href={`/models/${model.slug}`} className="block p-6">
                <div className="mb-3">
                  <h2 className="font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-200">
                    {model.name}
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {company?.name ?? provider?.name ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {model.avg_rating != null && (
                    <span className="flex items-center gap-1">
                      <span className="text-amber-500">★</span>
                      {Number(model.avg_rating).toFixed(1)}
                    </span>
                  )}
                  <span>{model.total_reviews ?? 0} reviews</span>
                </div>
                {model.highlights && model.highlights.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(model.highlights as string[]).slice(0, 3).map((h) => (
                      <span
                        key={h}
                        className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
