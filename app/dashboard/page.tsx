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

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
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

  const totalModels = keyList.reduce((acc, key) => {
    const provider = Array.isArray(key.providers) ? key.providers[0] : key.providers;
    const models = provider ? (Array.isArray(provider.models) ? provider.models : []) : [];
    return acc + models.length;
  }, 0);

  const totalRequests = usageList.reduce((acc, u) => acc + (u.request_count ?? 0), 0);

  const emailInitial = (user.email ?? "U")[0].toUpperCase();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">

      {/* Header */}
      <div className="mb-8 flex items-center gap-3 border-b border-zinc-100 pb-6 dark:border-zinc-800">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          {emailInitial}
        </span>
        <div>
          <h1 className="text-xl font-bold leading-tight text-zinc-900 dark:text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.email}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        <StatCard label="Provider Keys" value={keyList.length} />
        <StatCard label="Models Accessible" value={totalModels} />
        <StatCard label="Sandbox Requests" value={totalRequests} />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Provider Keys                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Provider Keys</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Models you have API access to via your submitted keys.
          </p>
        </div>

        {keyList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-6 py-8 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              You haven&apos;t submitted any provider keys yet.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm font-medium underline underline-offset-2 hover:text-zinc-600"
            >
              Browse the marketplace →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
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
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {company?.name ?? provider?.name ?? "Unknown Provider"}
                        </p>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                          Active
                        </span>
                      </div>
                      <p className="mt-0.5 font-mono text-xs text-zinc-400">
                        {key.key_prefix}••••••••••••
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-zinc-400">
                      Added {timeAgo(key.created_at)}
                    </span>
                  </div>

                  {models.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {models.map((m) => (
                        <Link
                          key={m.id}
                          href={`/models/${m.slug}`}
                          className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
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
      <section className="mb-8">
        <div className="mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Sandbox Usage</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Models you&apos;ve tested in the sandbox, sorted by most recent activity.
          </p>
        </div>

        {usageList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 px-6 py-8 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No sandbox usage yet.
            </p>
            <Link
              href="/"
              className="mt-3 inline-block text-sm font-medium underline underline-offset-2 hover:text-zinc-600"
            >
              Try a model in the sandbox →
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Model
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Requests
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Last Used
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
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
                      className="bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800/50"
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
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                        {company?.name ?? provider?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {u.request_count}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-400">
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
        className="text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        ← Back to Marketplace
      </Link>
    </div>
  );
}
