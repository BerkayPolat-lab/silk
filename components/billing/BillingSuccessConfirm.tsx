"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Status = "idle" | "loading" | "done" | "error";

export default function BillingSuccessConfirm({ sessionId }: { sessionId: string | undefined }) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!sessionId || !sessionId.startsWith("cs_")) {
      setStatus("done");
      setMessage(
        "If you just paid, open this page from the Stripe redirect link so we can credit your balance (or wait for the webhook / refresh the dashboard)."
      );
      return;
    }
    if (ran.current) return;
    ran.current = true;

    async function confirm() {
      setStatus("loading");
      try {
        const res = await fetch("/api/billing/confirm-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          credited?: boolean;
          alreadyApplied?: boolean;
          error?: string;
        };
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error ?? "Could not confirm payment.");
          return;
        }
        setStatus("done");
        if (data.alreadyApplied) {
          setMessage("Balance was already credited (webhook or previous visit).");
        } else if (data.credited) {
          setMessage("Your prepaid balance has been updated.");
        } else {
          setMessage("No change applied. If your balance looks wrong, check the dashboard or contact support.");
        }
      } catch {
        setStatus("error");
        setMessage("Network error while confirming payment.");
      }
    }

    void confirm();
  }, [sessionId]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold">Payment successful</h1>
      {sessionId?.startsWith("cs_") && status === "loading" && (
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">Updating your balance…</p>
      )}
      {message && (
        <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      )}
      {status === "error" && (
        <p className="mb-4 text-sm text-amber-800 dark:text-amber-200">
          If you use local development, ensure <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">stripe listen</code>{" "}
          is running and <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">STRIPE_WEBHOOK_SECRET</code> matches
          the CLI, or rely on this page&apos;s confirmation after redirect.
        </p>
      )}
      <Link
        href="/dashboard"
        className="text-sm font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
