"use client";

import { useRouter, useSearchParams } from "next/navigation";

export type BookingsSort =
  | "new"
  | "name-asc"
  | "name-desc"
  | "price-desc"
  | "price-asc"
  | "guests-desc"
  | "guests-asc"
  | "category";

export const BOOKINGS_SORT_OPTIONS: { value: BookingsSort; label: string }[] = [
  { value: "new", label: "Сначала новые" },
  { value: "name-asc", label: "Объект: А–Я" },
  { value: "name-desc", label: "Объект: Я–А" },
  { value: "guests-desc", label: "Гостей: больше → меньше" },
  { value: "guests-asc", label: "Гостей: меньше → больше" },
  { value: "price-desc", label: "Сумма: больше → меньше" },
  { value: "price-asc", label: "Сумма: меньше → больше" },
  { value: "category", label: "Категория" },
];

export const DEFAULT_BOOKINGS_SORT: BookingsSort = "new";

/**
 * Селект сортировки списка броней. Меняет URL-параметр `sort`, сортировка
 * выполняется на сервере в запросе Prisma (страница — server component).
 */
export function BookingsSortSelect({ value }: { value: BookingsSort }) {
  const router = useRouter();
  const params = useSearchParams();

  function onChange(next: BookingsSort) {
    const sp = new URLSearchParams(params.toString());
    sp.delete("page"); // смена сортировки — на первую страницу
    if (next === DEFAULT_BOOKINGS_SORT) sp.delete("sort");
    else sp.set("sort", next);
    const qs = sp.toString();
    router.push(qs ? `/admin/bookings?${qs}` : "/admin/bookings");
  }

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as BookingsSort)}
      aria-label="Сортировка броней"
      className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {BOOKINGS_SORT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
