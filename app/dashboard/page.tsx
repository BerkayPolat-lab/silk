import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Dashboard</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Welcome, {user.email}. API keys and usage tracking will be available
        here in a future update.
      </p>
      <Link
        href="/"
        className="mt-4 inline-block text-sm text-zinc-600 hover:underline dark:text-zinc-400"
      >
        ← Back to Marketplace
      </Link>
    </div>
  );
}
