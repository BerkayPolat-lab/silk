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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">
          Marketplace
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {company?.name ?? provider.name}
        </span>
      </nav>

      <div className="mb-10">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">
          {company?.name ?? provider.name}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-zinc-600 dark:text-zinc-400">
          {provider.avg_rating != null && (
            <span className="flex items-center gap-1">
              <span className="text-amber-500">★</span>
              {Number(provider.avg_rating).toFixed(1)}
            </span>
          )}
          {provider.total_reviews != null && provider.total_reviews > 0 && (
            <span>{provider.total_reviews} reviews</span>
          )}
          {company?.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              Website →
            </a>
          )}
        </div>
      </div>

      <h2 className="mb-4 text-lg font-semibold">Models</h2>
      <div className="space-y-3">
        {(models ?? []).map((m) => (
          <Link
            key={m.id}
            href={`/models/${m.slug}`}
            className="block rounded-lg border border-zinc-200 p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium">{m.name}</span>
              <span className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1">
                  <span className="text-amber-500">★</span>
                  {Number(m.avg_rating ?? 0).toFixed(1)}
                </span>
                <span>{m.total_reviews ?? 0} reviews</span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8">
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
