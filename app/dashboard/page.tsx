import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Provider keys the user has submitted, joined with provider + its models
  const { data: providerKeys } = await supabase
    .from("user_api_keys")
    .select(
      `
      id,
      key_prefix,
      name,
      created_at,
      last_used_at,
      providers (
        id,
        name,
        slug,
        companies ( name ),
        models ( id, name, slug )
      )
    `
    )
    .eq("user_id", user.id)
    .not("provider_id", "is", null)
    .order("created_at", { ascending: false });

  // Sandbox usage — models the user has chatted with
  const { data: usage } = await supabase
    .from("api_usage")
    .select(
      `
      request_count,
      first_used_at,
      last_used_at,
      models (
        id,
        name,
        slug,
        providers (
          name,
          companies ( name )
        )
      )
    `
    )
    .eq("user_id", user.id)
    .order("last_used_at", { ascending: false });

  const keyList = providerKeys ?? [];
  const usageList = usage ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold">Dashboard</h1>
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>

      {/* ------------------------------------------------------------------ */}
      {/* Provider Keys                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold">Provider Keys</h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Models you have API access to via your submitted provider keys.
        </p>

        {keyList.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 px-4 py-6 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              You haven&apos;t submitted any provider keys yet.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm font-medium underline underline-offset-2"
            >
              Browse the marketplace →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {keyList.map((key) => {
              const provider = Array.isArray(key.providers)
                ? key.providers[0]
                : key.providers;
              const company = provider
                ? Array.isArray(provider.companies)
                  ? provider.companies[0]
                  : provider.companies
                : null;
              const models: { id: string; name: string; slug: string }[] =
                provider
                  ? Array.isArray(provider.models)
                    ? provider.models
                    : []
                  : [];

              return (
                <div
                  key={key.id}
                  className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {company?.name ?? provider?.name ?? "Unknown Provider"}
                      </p>
                      <p className="font-mono text-xs text-zinc-400">
                        {key.key_prefix}••••••••••••
                      </p>
                    </div>
                    <span className="text-xs text-zinc-400">
                      Added {timeAgo(key.created_at)}
                    </span>
                  </div>

                  {models.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {models.map((m) => (
                        <Link
                          key={m.id}
                          href={`/models/${m.slug}`}
                          className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                        >
                          {m.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Sandbox Usage                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold">Sandbox Usage</h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Models you&apos;ve tested in the sandbox, sorted by most recent activity.
        </p>

        {usageList.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 px-4 py-6 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No sandbox usage yet.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm font-medium underline underline-offset-2"
            >
              Try a model in the sandbox →
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    Model
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    Requests
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">
                    Last Used
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {usageList.map((u, idx) => {
                  const model = Array.isArray(u.models) ? u.models[0] : u.models;
                  const provider = model
                    ? Array.isArray(model.providers)
                      ? model.providers[0]
                      : model.providers
                    : null;
                  const company = provider
                    ? Array.isArray(provider.companies)
                      ? provider.companies[0]
                      : provider.companies
                    : null;

                  return (
                    <tr
                      key={idx}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                    >
                      <td className="px-4 py-3">
                        {model ? (
                          <Link
                            href={`/models/${model.slug}`}
                            className="font-medium hover:underline"
                          >
                            {model.name}
                          </Link>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {company?.name ?? provider?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {u.request_count}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 dark:text-zinc-400">
                        {timeAgo(u.last_used_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Link
        href="/"
        className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← Back to Marketplace
      </Link>
    </div>
  );
}
