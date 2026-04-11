import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function ProviderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: provider } = await supabase
    .from("providers")
    .select(
      `
      id,
      name,
      slug,
      avg_rating,
      total_reviews,
      companies (
        id,
        name,
        logo_url,
        website
      )
    `
    )
    .eq("slug", slug)
    .single();

  if (!provider) notFound();

  const { data: models } = await supabase
    .from("models")
    .select("id, name, slug, avg_rating, total_reviews")
    .eq("provider_id", provider.id)
    .order("rank_order", { ascending: true });

  const company = provider.companies as {
    name?: string;
    website?: string;
    logo_url?: string;
  } | null;

  const displayName = company?.name ?? provider.name;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">
          Marketplace
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900 dark:text-zinc-100">{displayName}</span>
      </nav>

      {/* Provider header */}
      <div className="mb-10 flex items-start gap-5">
        {/* Company logo or initials fallback */}
        <div className="shrink-0">
          {company?.logo_url ? (
            <img
              src={company.logo_url}
              alt={`${displayName} logo`}
              className="h-14 w-14 rounded-xl border border-zinc-200 object-contain p-1 dark:border-zinc-700"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-xl font-semibold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {displayName}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
            {provider.avg_rating != null && Number(provider.avg_rating) > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-amber-500">★</span>
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {Number(provider.avg_rating).toFixed(1)}
                </span>
              </span>
            )}
            {provider.total_reviews != null && provider.total_reviews > 0 && (
              <span>
                {provider.total_reviews}{" "}
                {provider.total_reviews === 1 ? "review" : "reviews"}
              </span>
            )}
            {(models?.length ?? 0) > 0 && (
              <span>{models!.length} {models!.length === 1 ? "model" : "models"}</span>
            )}
            {company?.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                Website
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Models section */}
      <div>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Models
        </h2>

        {(models ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-6 py-10 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No models available.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(models ?? []).map((m) => {
              const hasRating = m.avg_rating != null && Number(m.avg_rating) > 0;
              const reviewCount = m.total_reviews ?? 0;

              return (
                <Link
                  key={m.id}
                  href={`/models/${m.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                      {m.name}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                    {hasRating && (
                      <span className="flex items-center gap-1">
                        <span className="text-amber-500">★</span>
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">
                          {Number(m.avg_rating).toFixed(1)}
                        </span>
                      </span>
                    )}
                    {reviewCount > 0 && (
                      <span>{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</span>
                    )}
                    <svg
                      className="h-4 w-4 text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-10">
        <Link
          href="/"
          className="text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Back to Marketplace
        </Link>
      </div>
    </div>
  );
}
