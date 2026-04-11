"use client";

import { useEffect, useState } from "react";
import { useCart, type CartItem } from "@/context/CartContext";

type Props = {
  model: CartItem;
  /**
   * Pre-checked server-side: true if the user already has a key for this
   * model's provider. Avoids a client-side fetch on initial render.
   */
  initiallyOwned?: boolean;
};

export default function AddToCartButton({ model, initiallyOwned = false }: Props) {
  const { addItem, removeItem, hasItem } = useCart();
  const inCart = hasItem(model.id);

  // "owned" = user has a key on file for this model's provider
  const [owned, setOwned] = useState(initiallyOwned);

  // If not pre-confirmed by the server (e.g. after client-side navigation),
  // verify on mount by checking the user's existing provider keys.
  useEffect(() => {
    if (initiallyOwned) return;
    let cancelled = false;

    async function checkOwnership() {
      try {
        const res = await fetch("/api/purchases");
        if (!res.ok) return;
        const keys = (await res.json()) as Array<{ provider_id?: string }>;
        if (cancelled) return;
        const owns = keys.some((k) => k.provider_id === model.providerId);
        if (owns) setOwned(true);
      } catch {
        // non-fatal
      }
    }

    void checkOwnership();
    return () => { cancelled = true; };
  }, [model.providerId, initiallyOwned]);

  if (owned) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
        ✓ Access Granted
      </span>
    );
  }

  if (inCart) {
    return (
      <button
        onClick={() => removeItem(model.id)}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-600 hover:border-red-300 hover:text-red-600 dark:border-zinc-600 dark:text-zinc-300 dark:hover:border-red-700 dark:hover:text-red-400"
      >
        ✕ Remove
      </button>
    );
  }

  return (
    <button
      onClick={() => addItem(model)}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-900 bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 hover:border-zinc-700 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:hover:border-zinc-300"
    >
      + Get Access
    </button>
  );
}
