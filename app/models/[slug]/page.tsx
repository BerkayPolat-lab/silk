import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { ModelDetail, Review, ReviewWithOwnership } from "@/types";
import ReviewForm from "@/components/reviews/ReviewForm";
import ReviewList from "@/components/reviews/ReviewList";

export default async function ModelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: model } = await supabase
    .from("models")
    .select(
      `
      id,
      name,
      slug,
      description,
      highlights,
      rank_order,
      api_docs,
      avg_rating,
      total_reviews,
      providers (
        id,
        name,
        slug,
        avg_rating,
        companies (
          id,
          name,
          logo_url,
          website
        )
      )
    `
    )
    .eq("slug", slug)
    .single();

  if (!model) notFound();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("model_id, comment_id, user_id, author_name, rating, content, created_at")
    .eq("model_id", model.id)
    .order("created_at", { ascending: false });

  const rawProviders = model.providers;
  const providers = Array.isArray(rawProviders)
    ? (rawProviders[0] ?? null)
    : rawProviders;

  const modelDetail: ModelDetail = {
    ...model,
    reviews: (reviews ?? []) as Review[],
    providers: providers as unknown as ModelDetail["providers"],
  };

  const provider = modelDetail.providers;
  const company = provider?.companies;
  const hasRating = modelDetail.avg_rating != null && Number(modelDetail.avg_rating) > 0;
  const reviewCount = modelDetail.total_reviews ?? 0;

  const reviewsWithOwnership = (reviews ?? []).map((review) => ({
    ...review,
    isOwner: Boolean(user?.id && review.user_id === user.id),
  })) as ReviewWithOwnership[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="transition-colors hover:text-zinc-700 dark:hover:text-zinc-300">
          Marketplace
        </Link>
        {provider && (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/providers/${provider.slug}`}
              className="transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {company?.name ?? provider.name}
            </Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-zinc-900 dark:text-zinc-100">{modelDetail.name}</span>
      </nav>

      {/* Page header */}
      <div className="mb-10 border-b border-zinc-100 pb-8 dark:border-zinc-800">
        {/* Provider label */}
        {(company?.name ?? provider?.name) && (
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            {company?.name ?? provider?.name}
          </p>
        )}

        <h1 className="mb-3 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {modelDetail.name}
        </h1>

        {/* Meta row: rating, reviews, website */}
        <div className="mb-5 flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
          {hasRating && (
            <span className="flex items-center gap-1">
              <span className="text-amber-400">★</span>
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {Number(modelDetail.avg_rating).toFixed(1)}
              </span>
            </span>
          )}
          {reviewCount > 0 && (
            <span>{reviewCount} {reviewCount === 1 ? "review" : "reviews"}</span>
          )}
          {company?.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              {company.name}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Overview */}
      {modelDetail.description && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Overview
          </h2>
          <p className="leading-relaxed text-zinc-600 dark:text-zinc-400">
            {modelDetail.description}
          </p>
        </section>
      )}

      {/* Highlights */}
      {modelDetail.highlights && modelDetail.highlights.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Highlights
          </h2>
          <ul className="flex flex-wrap gap-2">
            {(modelDetail.highlights as string[]).flatMap((h) => {
              if (h.startsWith("Categories:")) {
                return h
                  .replace("Categories:", "")
                  .split(",")
                  .map((c) => c.trim())
                  .filter(Boolean)
                  .map((cat) => ({ label: cat, isCategory: true }));
              }
              return [{ label: h, isCategory: false }];
            }).map(({ label, isCategory }) => (
              <li
                key={label}
                className={
                  isCategory
                    ? "rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-500"
                    : "rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }
              >
                {label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* API Docs */}
      {modelDetail.api_docs && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Documentation
          </h2>
          <a
            href={modelDetail.api_docs}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-700 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            View API documentation
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </section>
      )}

      {/* Try in Sandbox */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Try it
        </h2>
        <Link
          href={`/sandbox/${modelDetail.slug}`}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Open Sandbox
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </section>

      <ReviewForm modelSlug={modelDetail.slug} />
      <ReviewList modelSlug={modelDetail.slug} reviews={reviewsWithOwnership} />

      <div className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
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
