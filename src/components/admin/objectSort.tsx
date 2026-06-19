"use client";

// Общая сортировка объектов для выпадающих списков форм брони (одиночной и
// групповой). Минимальный интерфейс — поля, по которым умеем сортировать.
export type SortableObject = {
  name: string;
  categoryName: string;
  typeName: string;
  baseCapacity: number;
  basePrice: number;
};

export type ObjectSort =
  | "name-asc"
  | "name-desc"
  | "cap-desc"
  | "cap-asc"
  | "price-desc"
  | "price-asc"
  | "category";

export const DEFAULT_OBJECT_SORT: ObjectSort = "name-asc";

export const OBJECT_SORT_OPTIONS: { value: ObjectSort; label: string }[] = [
  { value: "name-asc", label: "Название: А–Я" },
  { value: "name-desc", label: "Название: Я–А" },
  { value: "cap-desc", label: "Вместимость: больше → меньше" },
  { value: "cap-asc", label: "Вместимость: меньше → больше" },
  { value: "price-desc", label: "Цена: больше → меньше" },
  { value: "price-asc", label: "Цена: меньше → больше" },
  { value: "category", label: "Категория / тип" },
];

function cmpName(a: string, b: string): number {
  // numeric:true — чтобы «Домик 2» шёл перед «Домик 10».
  return a.localeCompare(b, "ru", { numeric: true, sensitivity: "base" });
}

/** Возвращает новый отсортированный массив, не мутируя исходный. */
export function sortObjects<T extends SortableObject>(
  items: T[],
  sort: ObjectSort,
): T[] {
  const arr = [...items];
  switch (sort) {
    case "name-asc":
      return arr.sort((a, b) => cmpName(a.name, b.name));
    case "name-desc":
      return arr.sort((a, b) => cmpName(b.name, a.name));
    case "cap-desc":
      return arr.sort(
        (a, b) => b.baseCapacity - a.baseCapacity || cmpName(a.name, b.name),
      );
    case "cap-asc":
      return arr.sort(
        (a, b) => a.baseCapacity - b.baseCapacity || cmpName(a.name, b.name),
      );
    case "price-desc":
      return arr.sort(
        (a, b) => b.basePrice - a.basePrice || cmpName(a.name, b.name),
      );
    case "price-asc":
      return arr.sort(
        (a, b) => a.basePrice - b.basePrice || cmpName(a.name, b.name),
      );
    case "category":
      return arr.sort(
        (a, b) =>
          cmpName(a.categoryName, b.categoryName) ||
          cmpName(a.typeName, b.typeName) ||
          cmpName(a.name, b.name),
      );
    default:
      return arr;
  }
}

/** Компактный селект выбора порядка сортировки. */
export function ObjectSortSelect({
  value,
  onChange,
  className,
}: {
  value: ObjectSort;
  onChange: (s: ObjectSort) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ObjectSort)}
      // mousedown не должен закрывать выпадающий список / снимать фокус
      onMouseDown={(e) => e.stopPropagation()}
      className={
        "h-8 rounded-md border border-input bg-background px-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (className ?? "")
      }
      aria-label="Сортировка объектов"
    >
      {OBJECT_SORT_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
