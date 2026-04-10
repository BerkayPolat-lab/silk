"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type CartItem = {
  id: string;           // model UUID
  slug: string;
  name: string;
  providerId: string;
  providerName: string;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (modelId: string) => void;
  clearCart: () => void;
  hasItem: (modelId: string) => boolean;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) =>
      prev.some((i) => i.id === item.id) ? prev : [...prev, item]
    );
  }, []);

  const removeItem = useCallback((modelId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== modelId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const hasItem = useCallback(
    (modelId: string) => items.some((i) => i.id === modelId),
    [items]
  );

  const value = useMemo(
    () => ({ items, addItem, removeItem, clearCart, hasItem }),
    [items, addItem, removeItem, clearCart, hasItem]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
