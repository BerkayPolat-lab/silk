import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { ModelDetail, Review } from "@/types";

export default async function ModelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

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
    .select("model_id, comment_id, author_name, rating, content, created_at")
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
          {provider?.avg_rating != null && (
            <span className="flex items-center gap-1">
              <span className="text-amber-500">★</span>
              {Number(provider.avg_rating).toFixed(1)} rating
            </span>
          )}
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

      {modelDetail.reviews.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">Reviews</h2>
          <div className="space-y-4">
            {modelDetail.reviews.map((r) => (
              <div
                key={r.comment_id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex text-amber-500">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(5 - r.rating)}
                  </span>
                  <span className="text-sm font-medium">
                    {r.author_name ?? "Anonymous"}
                  </span>
                  <span className="text-sm text-zinc-500">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                {r.content && (
                  <p className="text-zinc-600 dark:text-zinc-400">{r.content}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

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
