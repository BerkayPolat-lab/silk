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
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Hero */}
      <div className="mb-10 border-b border-zinc-100 pb-8 dark:border-zinc-800">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          LLM API Marketplace
        </h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">
          Compare, review, and get access to models from top providers.
        </p>
        {modelList.length > 0 && (
          <p className="mt-3 text-sm text-zinc-400 dark:text-zinc-500">
            {modelList.length} {modelList.length === 1 ? "model" : "models"}
            {uniqueProviders > 0 && (
              <> from {uniqueProviders} {uniqueProviders === 1 ? "provider" : "providers"}</>
            )}
          </p>
        )}
      </div>

      {/* Model grid */}
      {modelList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 px-6 py-16 text-center dark:border-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No models available yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modelList.map((model) => {
            const provider = model.providers as (Model["providers"] & { id?: string }) | null;
            const company = provider?.companies as { name?: string } | null;
            const providerDisplayName = company?.name ?? provider?.name ?? null;
            const hasRating = model.avg_rating != null && Number(model.avg_rating) > 0;
            const reviewCount = model.total_reviews ?? 0;

            return (
              <div
                key={model.id}
                className="group flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <Link href={`/models/${model.slug}`} className="flex flex-1 flex-col p-5">
                  {/* Provider label */}
                  {providerDisplayName && (
                    <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                      {providerDisplayName}
                    </p>
                  )}

                  {/* Model name */}
                  <h2 className="mb-3 font-semibold leading-snug text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-200">
                    {model.name}
                  </h2>

                  {/* Rating + reviews */}
                  {(hasRating || reviewCount > 0) && (
                    <div className="mb-3 flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                      {hasRating && (
                        <span className="flex items-center gap-1">
                          <span className="text-amber-400">★</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {Number(model.avg_rating).toFixed(1)}
                          </span>
                        </span>
                      )}
                      {reviewCount > 0 && (
                        <span>{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</span>
                      )}
                    </div>
                  )}

                  {/* Highlights / category pills */}
                  {model.highlights && model.highlights.length > 0 && (
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                      {(model.highlights as string[]).flatMap((h) => {
                        if (h.startsWith("Categories:")) {
                          return h
                            .replace("Categories:", "")
                            .split(",")
                            .map((c) => c.trim())
                            .filter(Boolean)
                            .map((cat) => ({ label: cat, isCategory: true }));
                        }
                        return [{ label: h, isCategory: false }];
                      }).slice(0, 5).map(({ label, isCategory }) => (
                        <span
                          key={label}
                          className={
                            isCategory
                              ? "rounded border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-500"
                              : "rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>

                {/* Cart action */}
                {provider?.id && (
                  <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
                    <AddToCartButton
                      model={{
                        id: model.id,
                        slug: model.slug,
                        name: model.name,
                        providerId: provider.id,
                        providerName: provider.name ?? "",
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
