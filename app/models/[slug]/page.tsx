import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { ModelDetail, Product, Review } from "@/types";

function StatusBadge({ status }: { status: string }) {
  const isNew = status === "new";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-sm font-medium ${
        isNew
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
      }`}
    >
      {isNew ? "new" : status}
    </span>
  );
}

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
      token_count,
      status,
      description,
      highlights,
      rank_order,
      documentation_url,
      output_examples,
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

  const [{ data: products }, { data: reviews }] = await Promise.all([
    supabase
      .from("products")
      .select("*")
      .eq("model_id", model.id)
      .order("token_limit", { ascending: false }),
    supabase
      .from("reviews")
      .select("id, author_name, rating, content, created_at")
      .eq("model_id", model.id)
      .order("created_at", { ascending: false }),
  ]);

  const rawProviders = model.providers;
  const providers = Array.isArray(rawProviders)
    ? (rawProviders[0] ?? null)
    : rawProviders;

  const modelDetail: ModelDetail = {
    ...model,
    output_examples: (model.output_examples as ModelDetail["output_examples"]) ?? [],
    products: (products ?? []) as Product[],
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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            {modelDetail.name}
          </h1>
          <StatusBadge status={modelDetail.status} />
        </div>
        <div className="flex flex-wrap items-center gap-4 text-zinc-600 dark:text-zinc-400">
          <span>{modelDetail.token_count} tokens</span>
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

      {modelDetail.products.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">Plans</h2>
          <div className="space-y-4">
            {modelDetail.products.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-medium">{p.name}</span>
                  {p.billing_rate && (
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {p.billing_rate}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-zinc-500 dark:text-zinc-400">
                  {p.token_limit != null && (
                    <span>{p.token_limit.toLocaleString()} tokens</span>
                  )}
                  {p.call_rate_rpm != null && (
                    <span>{p.call_rate_rpm} RPM</span>
                  )}
                  {p.audience && <span>{p.audience}</span>}
                </div>
                {p.capabilities && p.capabilities.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(p.capabilities as string[]).map((c) => (
                      <span
                        key={c}
                        className="rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {modelDetail.documentation_url && (
        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">Documentation</h2>
          <a
            href={modelDetail.documentation_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            View documentation →
          </a>
        </section>
      )}

      {modelDetail.output_examples &&
        modelDetail.output_examples.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold">Output Examples</h2>
            <div className="space-y-4">
              {modelDetail.output_examples.map((ex, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <p className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Prompt
                  </p>
                  <pre className="mb-4 overflow-x-auto whitespace-pre-wrap rounded bg-white p-3 text-sm dark:bg-zinc-950">
                    {ex.prompt}
                  </pre>
                  <p className="mb-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Output
                  </p>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-white p-3 text-sm dark:bg-zinc-950">
                    {ex.output}
                  </pre>
                </div>
              ))}
            </div>
          </section>
        )}

      {modelDetail.reviews.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">Reviews</h2>
          <div className="space-y-4">
            {modelDetail.reviews.map((r) => (
              <div
                key={r.id}
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
