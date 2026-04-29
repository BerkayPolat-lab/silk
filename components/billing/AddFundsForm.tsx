"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { kalshiDepositButtonClassName } from "@/lib/kalshiDepositButton";

const MIN_CENTS = 50;

export default function AddFundsForm() {
  const router = useRouter();
  const [dollars, setDollars] = useState("5.00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number.parseFloat(dollars);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Enter a valid amount in USD.");
      return;
    }
    const amountCents = Math.round(parsed * 100);
    if (amountCents < MIN_CENTS) {
      setError(`Minimum top-up is $${(MIN_CENTS / 100).toFixed(2)}.`);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents, currency: "usd" }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Checkout could not be started.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError("No checkout URL returned.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-4">
      <div>
        <label htmlFor="amount" className="mb-1 block text-sm font-medium">
          Amount (USD)
        </label>
        <input
          id="amount"
          type="number"
          inputMode="decimal"
          min={MIN_CENTS / 100}
          step="0.01"
          value={dollars}
          onChange={(ev) => setDollars(ev.target.value)}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          required
        />
        <p className="mt-1 text-xs text-zinc-500">
          Minimum ${(MIN_CENTS / 100).toFixed(2)}. You will be redirected to Stripe to pay securely.
        </p>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy} className={kalshiDepositButtonClassName}>
          {busy ? "Redirecting…" : "Continue to payment"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
        >
          Cancel
        </button>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        After payment, return to the{" "}
        <Link href="/dashboard" className="font-medium underline underline-offset-2">
          dashboard
        </Link>{" "}
        to generate your API key.
      </p>
    </form>
  );
}
