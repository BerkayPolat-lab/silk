import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SandboxChat } from "@/components/sandbox/SandboxChat";

export default async function SandboxPage({
  params,
}: {
  params: Promise<{ modelSlug: string }>;
}) {
  const { modelSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: model } = await supabase
    .from("models")
    .select("id, name, slug, description")
    .eq("slug", modelSlug)
    .single();

  if (!model) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">
          Marketplace
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/models/${model.slug}`}
          className="hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          {model.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900 dark:text-zinc-100">Sandbox</span>
      </nav>

      <div className="mb-5">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Sandbox</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Chat with <span className="font-medium text-zinc-700 dark:text-zinc-300">{model.name}</span> (text-to-text).
        </p>
      </div>

      {/* Ephemeral notice */}
      <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <span>
          Conversations are <strong>not saved</strong>. Refreshing or leaving the page will clear this chat.
        </span>
      </div>

      <SandboxChat modelSlug={model.slug} />
    </div>
  );
}

