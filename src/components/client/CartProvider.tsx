"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Выбранное клиентом расписание (сохраняется при добавлении из карточки объекта,
// чтобы сразу подставить в корзине). Поля зависят от режима объекта.
export type CartSchedule = {
  guestsCount?: number;
  checkInDate?: string;
  checkOutDate?: string;
  startAt?: string;
  endAt?: string;
  slotId?: string;
  slotDate?: string;
  bookingDate?: string;
};

export type CartItem = { id: string; name: string; schedule?: CartSchedule };

type CartContextValue = {
  items: CartItem[];
  count: number;
  has: (id: string) => boolean;
  add: (item: CartItem) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const STORAGE_KEY = "bookingCart:v1";

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Загрузка из localStorage на маунте.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setItems(
            parsed.filter(
              (x): x is CartItem =>
                x && typeof x.id === "string" && typeof x.name === "string",
            ),
          );
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Сохранение в localStorage при изменениях (после гидрации).
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // ignore
    }
  }, [items, hydrated]);

  const has = useCallback((id: string) => items.some((i) => i.id === id), [items]);

  // upsert: если объект уже в корзине — обновляем расписание.
  const add = useCallback((item: CartItem) => {
    setItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.map((i) => (i.id === item.id ? { ...i, ...item } : i))
        : [...prev, item],
    );
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({ items, count: items.length, has, add, remove, clear }),
    [items, has, add, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
