"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./CartProvider";

export function CartBadge() {
  const { count } = useCart();
  if (count === 0) return null;
  return (
    <Link
      href="/booking/cart"
      className="relative inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border bg-secondary text-secondary-foreground hover:bg-secondary/80 whitespace-nowrap"
      title="Корзина"
    >
      <ShoppingCart className="w-4 h-4" />
      <span className="hidden sm:inline">Корзина</span>
      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        {count}
      </span>
    </Link>
  );
}
