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

      <div className="mb-4">
        <h1 className="mb-1 text-3xl font-bold tracking-tight">Sandbox</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Chat with <span className="font-medium text-zinc-900 dark:text-zinc-100">{model.name}</span> (text-to-text).
        </p>
      </div>

      <SandboxChat modelSlug={model.slug} />
    </div>
  );
}

