"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { kalshiDepositButtonClassName } from "@/lib/kalshiDepositButton";
import { SignOutButton } from "@/components/SignOutButton";

function tabClassName(isActive: boolean) {
  return [
    "transition-colors hover:text-zinc-900 dark:hover:text-zinc-100",
    isActive ? "font-bold text-zinc-900 dark:text-zinc-100" : "font-medium text-zinc-600 dark:text-zinc-400",
  ].join(" ");
}

export default function HeaderNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname();
  const isMarketplaceActive = pathname === "/";
  const isCompareActive = pathname.startsWith("/compare");
  const isAnalyticsActive = pathname.startsWith("/analytics");
  const isDashboardActive = pathname.startsWith("/dashboard");

  return (
    <nav className="flex items-center gap-5 text-sm">
      <Link href="/" className={tabClassName(isMarketplaceActive)}>
        Marketplace
      </Link>
      <Link
        href="/compare"
        className={`text-sm transition-colors ${
          isCompareActive ? "font-bold text-[#3B82F6]" : "font-medium text-[#3B82F6] hover:text-[#2563EB]"
        }`}
      >
        Compare
      </Link>
      <Link href="/analytics" className={tabClassName(isAnalyticsActive)}>
        Analytics
      </Link>
      {isAuthenticated ? (
        <>
          <Link href="/dashboard" className={tabClassName(isDashboardActive)}>
            Dashboard
          </Link>
          <Link href="/billing/add-funds" className={kalshiDepositButtonClassName}>
            Add funds
          </Link>
          <SignOutButton />
        </>
      ) : (
        <>
          <Link href="/login" className={tabClassName(pathname.startsWith("/login"))}>
            Sign in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Sign up
          </Link>
        </>
      )}
    </nav>
  );
}
