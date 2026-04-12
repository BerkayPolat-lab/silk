import MarketplaceClient from "@/components/MarketplaceClient";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Hero */}
      <div className="mb-10 border-b border-zinc-100 pb-8 dark:border-zinc-800">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          LLM API Marketplace
        </h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">
          Compare, review, and get access to models from top providers.
        </p>
      </div>

      <MarketplaceClient />
    </div>
  );
}
