"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExistingKeyRow = {
  provider_id: string;
};

type ProviderGroup = {
  providerId: string;
  providerName: string;
  models: { id: string; name: string }[];
  alreadyKeyed: boolean;
};

// ---------------------------------------------------------------------------
// Helper: group cart items by provider and mark which are already keyed
// ---------------------------------------------------------------------------
function buildProviderGroups(
  items: ReturnType<typeof useCart>["items"],
  keyedIds: Set<string>
): ProviderGroup[] {
  const map = new Map<string, ProviderGroup>();
  for (const item of items) {
    if (!map.has(item.providerId)) {
      map.set(item.providerId, {
        providerId: item.providerId,
        providerName: item.providerName,
        models: [],
        alreadyKeyed: keyedIds.has(item.providerId),
      });
    }
    map.get(item.providerId)!.models.push({ id: item.id, name: item.name });
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CartDrawer() {
  const { items, removeItem, clearCart } = useCart();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingKeys, setCheckingKeys] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Raw key inputs keyed by providerId
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});

  // Provider IDs the user already has a key for
  const [keyedProviderIds, setKeyedProviderIds] = useState<Set<string>>(new Set());

  // ------------------------------------------------------------------
  // On drawer open: fetch which providers the user already has keys for
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!open || items.length === 0) return;
    let cancelled = false;

    async function fetchExistingKeys() {
      setCheckingKeys(true);
      try {
        const res = await fetch("/api/purchases");
        if (!res.ok) return;
        const data = (await res.json()) as ExistingKeyRow[];
        if (cancelled) return;
        setKeyedProviderIds(
          new Set(data.map((k) => k.provider_id).filter(Boolean))
        );
      } catch {
        // non-fatal — worst case we ask for a key that's already on file
      } finally {
        if (!cancelled) setCheckingKeys(false);
      }
    }

    void fetchExistingKeys();
    return () => { cancelled = true; };
  }, [open, items.length]);

  const providerGroups = useMemo(
    () => buildProviderGroups(items, keyedProviderIds),
    [items, keyedProviderIds]
  );

  const providersNeedingKeys = useMemo(
    () => providerGroups.filter((g) => !g.alreadyKeyed),
    [providerGroups]
  );

  // Submit button is enabled only when every un-keyed provider has a value
  const allKeysProvided = useMemo(
    () =>
      providersNeedingKeys.every(
        (g) => (keyInputs[g.providerId] ?? "").trim().length >= 8
      ),
    [providersNeedingKeys, keyInputs]
  );

  const handleKeyChange = useCallback((providerId: string, value: string) => {
    setKeyInputs((prev) => ({ ...prev, [providerId]: value }));
  }, []);

  // ------------------------------------------------------------------
  // Checkout
  // ------------------------------------------------------------------
  async function handleCheckout() {
    setError(null);

    // Build the apiKeys payload — only for providers that still need a key
    const apiKeys: Record<string, string> = {};
    for (const g of providersNeedingKeys) {
      const raw = (keyInputs[g.providerId] ?? "").trim();
      if (raw.length < 8) {
        setError(`Please enter a valid API key for ${g.providerName}.`);
        return;
      }
      apiKeys[g.providerId] = raw;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelIds: items.map((i) => i.id),
          apiKeys,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        missingProviders?: string[];
      } | null;

      if (!res.ok) {
        if (payload?.missingProviders?.length) {
          setError(
            `Missing keys for: ${payload.missingProviders.join(", ")}. Please fill in all fields.`
          );
        } else {
          setError(payload?.error ?? "Something went wrong. Please try again.");
        }
        return;
      }

      // Success
      setSuccess(true);
      clearCart();
      setKeyInputs({});
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        router.push("/dashboard");
        router.refresh();
      }, 1500);
    } finally {
      setLoading(false);
    }
  }

  const itemCount = items.length;

  return (
    <>
      {/* Cart icon button */}
      <button
        onClick={() => setOpen(true)}
        className="relative flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        aria-label="Open cart"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {itemCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            {itemCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-sm flex-col bg-white shadow-xl transition-transform duration-300 dark:bg-zinc-950 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold">
            Cart {itemCount > 0 && `(${itemCount})`}
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {success ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <span className="text-3xl">✓</span>
              <p className="font-medium">Access granted!</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Redirecting to your dashboard…
              </p>
            </div>
          ) : itemCount === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Your cart is empty. Browse the marketplace to add models.
            </p>
          ) : checkingKeys ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Checking your existing keys…
            </p>
          ) : (
            <div className="space-y-6">
              {providerGroups.map((group) => (
                <div key={group.providerId}>
                  {/* Provider header */}
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">{group.providerName}</h3>
                    {group.alreadyKeyed && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Key on file ✓
                      </span>
                    )}
                  </div>

                  {/* Models under this provider */}
                  <ul className="mb-3 space-y-2">
                    {group.models.map((model) => (
                      <li
                        key={model.id}
                        className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                      >
                        <span>{model.name}</span>
                        <button
                          onClick={() => removeItem(model.id)}
                          className="ml-2 text-xs text-zinc-400 hover:text-red-500"
                          aria-label={`Remove ${model.name}`}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Key input — only shown if this provider still needs a key */}
                  {!group.alreadyKeyed && (
                    <div>
                      <label
                        htmlFor={`key-${group.providerId}`}
                        className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400"
                      >
                        Your {group.providerName} API key
                      </label>
                      <input
                        id={`key-${group.providerId}`}
                        type="password"
                        autoComplete="off"
                        placeholder="sk-…"
                        value={keyInputs[group.providerId] ?? ""}
                        onChange={(e) =>
                          handleKeyChange(group.providerId, e.target.value)
                        }
                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/5 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-100/5"
                      />
                      <p className="mt-1 text-xs text-zinc-400">
                        Stored securely as a hash. The raw key is never saved.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && itemCount > 0 && !checkingKeys && (
          <div className="border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
            {error && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </p>
            )}
            {providersNeedingKeys.length > 0 && (
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                Enter your API{" "}
                {providersNeedingKeys.length > 1 ? "keys" : "key"} above to get
                access.
              </p>
            )}
            <button
              onClick={handleCheckout}
              disabled={loading || !allKeysProvided}
              className="w-full rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading
                ? "Saving…"
                : providersNeedingKeys.length === 0
                ? "Confirm Access"
                : "Submit Keys & Get Access"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
