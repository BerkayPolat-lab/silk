"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { kalshiDepositButtonClassName } from "@/lib/kalshiDepositButton";

type Props = {
  canCreateKey: boolean;
  initialKey: {
    id: string;
    key_prefix: string;
    created_at: string;
    last_used_at: string | null;
  } | null;
};

const COPY_FEEDBACK_MS = 2500;

export default function PlatformApiKeySection({ canCreateKey, initialKey }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedOnce, setRevealedOnce] = useState<string | null>(null);
  const [copySucceeded, setCopySucceeded] = useState(false);
  const copyFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
    };
  }, []);

  const mint = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/keys", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        apiKey?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not create API key.");
        return;
      }
      if (data.apiKey) {
        setRevealedOnce(data.apiKey);
      }
    } finally {
      setBusy(false);
    }
  }, []);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
      setCopySucceeded(true);
      if (copyFeedbackTimerRef.current) {
        clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = setTimeout(() => {
        setCopySucceeded(false);
        copyFeedbackTimerRef.current = null;
      }, COPY_FEEDBACK_MS);
    } catch {
      setCopySucceeded(false);
      setError("Could not copy to clipboard.");
    }
  }, []);

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
        Use this key with the Silk API gateway (OpenAI-compatible). Store it in
        environment variables; do not expose it in client-side code.
      </p>

      {revealedOnce && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/40">
          <p className="mb-2 text-xs font-medium text-amber-900 dark:text-amber-200">
            Copy this key now — it will not be shown again.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
              {revealedOnce}
            </code>
            <button
              type="button"
              onClick={() => copy(revealedOnce)}
              aria-live="polite"
              className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200 ${
                copySucceeded
                  ? "bg-emerald-600 text-white dark:bg-emerald-500"
                  : "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              }`}
            >
              {copySucceeded ? (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-7.5 10.5a.75.75 0 01-1.127.082l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 6.951-9.731a.75.75 0 011.052-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Copied!
                </>
              ) : (
                "Copy"
              )}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!initialKey && !revealedOnce && canCreateKey && (
        <button
          type="button"
          disabled={busy}
          onClick={mint}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {busy ? "Creating…" : "Generate API key"}
        </button>
      )}

      {!initialKey && !revealedOnce && !canCreateKey && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="mb-2">
            Add prepaid funds before you can generate a platform API key.
          </p>
          <Link href="/billing/add-funds" className={kalshiDepositButtonClassName}>
            Add funds
          </Link>
        </div>
      )}

      {initialKey && !revealedOnce && (
        <div>
          <p className="mb-1 text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Key on file
          </p>
          <p className="font-mono text-sm text-zinc-600 dark:text-zinc-400">
            {initialKey.key_prefix}••••••••••••••••••••••••
          </p>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            The full secret was shown only once when the key was created. To
            rotate, contact support or use a future revoke/regenerate flow.
          </p>
        </div>
      )}
    </div>
  );
}
