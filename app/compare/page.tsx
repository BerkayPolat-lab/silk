import CompareModelsPanel from "@/components/CompareModelsPanel";

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-10 border-b border-zinc-100 pb-8 dark:border-zinc-800">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Model Comparisons
        </h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400">
          Compare models side by side across capabilities, pricing, and quality signals.
        </p>
      </div>

      <CompareModelsPanel />
    </div>
  );
}
