import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold tracking-tight text-red-500 hover:text-red-600 transition-colors">
          Silk
        </Link>
        <HeaderNav isAuthenticated={Boolean(user)} />
      </div>
    </header>
  );
}
