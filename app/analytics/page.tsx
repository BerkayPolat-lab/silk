import AnalyticsClient from "@/components/analytics/AnalyticsClient";
import { getAnalyticsOverview } from "@/lib/analytics/usage";

export const revalidate = 300;

export default async function AnalyticsPage() {
  const overview = await getAnalyticsOverview();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Analytics</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Overall model usage across Silk, inspired by rankings-style insights.
        </p>
      </div>

      <AnalyticsClient overview={overview} />
    </div>
  );
}
