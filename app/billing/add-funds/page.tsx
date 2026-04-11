import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AddFundsForm from "@/components/billing/AddFundsForm";

export default async function AddFundsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/billing/add-funds");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <nav className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">
          Marketplace
        </Link>
        <span className="mx-2">/</span>
        <Link href="/dashboard" className="hover:text-zinc-700 dark:hover:text-zinc-300">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900 dark:text-zinc-100">Add funds</span>
      </nav>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Add funds</h1>
      <p className="mb-8 text-sm text-zinc-600 dark:text-zinc-400">
        Top up your prepaid balance with a one-time card payment. Funds are required before you can
        generate a Silk platform API key.
      </p>
      <AddFundsForm />
    </div>
  );
}
