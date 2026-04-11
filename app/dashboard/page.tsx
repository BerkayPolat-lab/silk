import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import PlatformApiKeySection from "@/components/billing/PlatformApiKeySection";
import { kalshiDepositButtonClassName } from "@/lib/kalshiDepositButton";

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

  const emailRaw = user.email?.trim() ?? "";
  const emailInitial =
    emailRaw.length > 0 ? emailRaw[0]!.toUpperCase() : "?";

  const { data: wallet } = await supabase
    .from("user_wallets")
    .select("balance_cents")
    .eq("user_id", user.id)
    .maybeSingle();

  const balanceCents = Number(wallet?.balance_cents ?? 0);
  const canCreatePlatformKey = balanceCents > 0;

  const { data: platformKey } = await supabase
    .from("user_api_keys")
    .select("id, key_prefix, created_at, last_used_at")
    .eq("user_id", user.id)
    .eq("key_type", "platform")
    .maybeSingle();

  const { data: byokKeys } = await supabase
    .from("user_api_keys")
    .select("id")
    .eq("user_id", user.id)
    .not("provider_id", "is", null);

  const keyList = byokKeys ?? [];

  const { data: usageEvents } = await supabase
    .from("api_usage_events")
    .select(
      `
      model_id,
      prompt_tokens,
      completion_tokens,
      cost_cents,
      created_at,
      rollup_request_count,
      legacy_first_used_at,
      source,
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
    .eq("user_id", user.id);

  type UsageEventRow = NonNullable<typeof usageEvents>[number];

  const usageByModel = new Map<
    string,
    {
      requestCount: number;
      lastUsedAt: string;
      firstUsedAt: string;
      model: UsageEventRow["models"];
    }
  >();

  for (const row of usageEvents ?? []) {
    const mid = row.model_id;
    const req = row.rollup_request_count ?? 1;
    const firstCandidate = row.legacy_first_used_at ?? row.created_at;
    const existing = usageByModel.get(mid);
    if (!existing) {
      usageByModel.set(mid, {
        requestCount: req,
        lastUsedAt: row.created_at,
        firstUsedAt: firstCandidate,
        model: row.models,
      });
    } else {
      existing.requestCount += req;
      if (new Date(row.created_at) > new Date(existing.lastUsedAt)) {
        existing.lastUsedAt = row.created_at;
      }
      if (new Date(firstCandidate) < new Date(existing.firstUsedAt)) {
        existing.firstUsedAt = firstCandidate;
      }
    }
  }

  const usageList = [...usageByModel.values()].sort(
    (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
  );

  const totalModels = usageList.length;
  const totalRequests = usageList.reduce((acc, u) => acc + u.requestCount, 0);

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
      {/* Billing & platform API                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-10">
        <h2 className="mb-1 text-lg font-semibold">Billing &amp; API access</h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Prepaid credits and your Silk-issued API key for the metered gateway.
        </p>

        <div className="mb-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Prepaid balance
            </h3>
            <Link href="/billing/add-funds" className={kalshiDepositButtonClassName}>
              Add funds
            </Link>
          </div>
          <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
            Top up with Stripe. You need a positive balance to generate a platform API key.
          </p>
          <p className="font-mono text-lg tabular-nums text-zinc-900 dark:text-zinc-100">
            ${(balanceCents / 100).toFixed(2)}{" "}
            <span className="text-sm font-sans text-zinc-500">USD</span>
          </p>
        </div>

        <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Silk platform API key
        </h3>
        <PlatformApiKeySection canCreateKey={canCreatePlatformKey} initialKey={platformKey} />
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
                  const model = Array.isArray(u.model) ? u.model[0] : u.model;
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
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {u.requestCount}
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500 dark:text-zinc-400">
                        {timeAgo(u.lastUsedAt)}
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
