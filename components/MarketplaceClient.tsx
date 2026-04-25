"use client";

import ModelSearch from "@/components/ModelSearch";

export default function MarketplaceClient() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Browse and filter models below.</p>
      <ModelSearch />
    </div>
  );
}
