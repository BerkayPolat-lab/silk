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
  const reviewsWithOwnership = (reviews ?? []).map((review) => ({
    ...review,
    isOwner: Boolean(user?.id && review.user_id === user.id),
  })) as ReviewWithOwnership[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">
          Marketplace
        </Link>
        {provider && (
          <>
            <span className="mx-2">/</span>
            <Link
              href={`/providers/${provider.slug}`}
              className="hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              {company?.name ?? provider.name}
            </Link>
          </>
        )}
        <span className="mx-2">/</span>
        <span className="text-zinc-900 dark:text-zinc-100">{modelDetail.name}</span>
      </nav>

      <div className="mb-10">
        <h1 className="mb-4 text-3xl font-bold tracking-tight">
          {modelDetail.name}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-zinc-600 dark:text-zinc-400">
          {modelDetail.avg_rating != null && (
            <span className="flex items-center gap-1">
              <span className="text-amber-500">★</span>
              {Number(modelDetail.avg_rating).toFixed(1)} model rating
            </span>
          )}
          <span>{modelDetail.total_reviews ?? 0} reviews</span>
          {company?.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {company.name} →
            </a>
          )}
        </div>
      </div>

      {modelDetail.description && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Overview</h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            {modelDetail.description}
          </p>
        </section>
      )}

      {modelDetail.highlights && modelDetail.highlights.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Top Highlights</h2>
          <ul className="flex flex-wrap gap-2">
            {(modelDetail.highlights as string[]).map((h) => (
              <li
                key={h}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm dark:bg-zinc-800"
              >
                {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      {modelDetail.api_docs && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Documentation</h2>
          <a
            href={modelDetail.api_docs}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            View API documentation →
          </a>
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Try it</h2>
        <Link
          href={`/sandbox/${modelDetail.slug}`}
          className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Try in Sandbox
        </Link>
      </section>

      <ReviewForm modelSlug={modelDetail.slug} />
      <ReviewList modelSlug={modelDetail.slug} reviews={reviewsWithOwnership} />

      <div className="pt-4">
        <Link
          href="/"
          className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
        >
          ← Back to Marketplace
        </Link>
      </div>
    </div>
  );
}
