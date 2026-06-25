"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";

const PATH = "/admin/bookings";

type CategoryOption = { id: string; name: string };
type TypeOption = { id: string; name: string; categoryName: string; categoryId: string };
type ObjectOption = { id: string; name: string; typeId: string; categoryId: string };

const STATUS_SEGMENTS: { value: string; label: string }[] = [
  { value: "", label: "Все" },
  { value: "PENDING", label: "Ожидают" },
  { value: "PREPAID", label: "Аванс внесён" },
  { value: "PAID", label: "Оплачены" },
  { value: "CANCELLED", label: "Отменены" },
  { value: "COMPLETED", label: "Завершены" },
];

const DATE_FIELD_SEGMENTS: { value: string; label: string }[] = [
  { value: "start", label: "Дата брони" },
  { value: "created", label: "Дата создания" },
];

// Ключи, которые сбрасываются «Сбросить всё» (sort сохраняется).
const RESET_KEYS = ["q", "cat", "type", "obj", "from", "to", "dateField", "status"];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingsFilters({
  categories,
  types,
  objects,
  current,
}: {
  categories: CategoryOption[];
  types: TypeOption[];
  objects: ObjectOption[];
  current: {
    status?: string;
    q?: string;
    cats?: string[];
    types?: string[];
    objs?: string[];
    from?: string;
    to?: string;
    dateField?: string;
  };
}) {
  const router = useRouter();
  const params = useSearchParams();

  const dateField = current.dateField === "created" ? "created" : "start";
  const selectedCats = useMemo(() => current.cats ?? [], [current.cats]);
  const selectedTypes = useMemo(() => current.types ?? [], [current.types]);
  const selectedObjs = useMemo(() => current.objs ?? [], [current.objs]);

  // Поиск — локальный стейт с дебаунсом, чтобы не дёргать навигацию на каждый символ.
  const [search, setSearch] = useState(current.q ?? "");
  useEffect(() => {
    setSearch(current.q ?? "");
  }, [current.q]);

  // Копирует текущие параметры, применяет изменения (пустое значение удаляет
  // ключ), сохраняет sort и прочие параметры, переходит на новый URL.
  function setParams(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    // Любое изменение фильтра возвращает на первую страницу.
    sp.delete("page");
    for (const [key, value] of Object.entries(updates)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    const qs = sp.toString();
    router.push(qs ? `${PATH}?${qs}` : PATH);
  }

  // Дебаунс поиска.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const trimmed = search.trim();
    if (trimmed === (current.q ?? "")) return;
    const t = setTimeout(() => setParams({ q: trimmed || undefined }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Каскад: типы сужаются категориями, объекты — категориями и выбранными типами.
  const typesForCategory = useMemo(
    () =>
      selectedCats.length
        ? types.filter((t) => selectedCats.includes(t.categoryId))
        : types,
    [types, selectedCats],
  );
  const objectsForSelection = useMemo(
    () =>
      objects.filter(
        (o) =>
          (selectedCats.length === 0 || selectedCats.includes(o.categoryId)) &&
          (selectedTypes.length === 0 || selectedTypes.includes(o.typeId)),
      ),
    [objects, selectedCats, selectedTypes],
  );

  // Смена категорий: подрезаем выбранные типы и объекты, которые больше не
  // принадлежат выбранным категориям.
  function onCatsChange(nextCats: string[]) {
    const validTypes = selectedTypes.filter((id) => {
      const t = types.find((x) => x.id === id);
      return t && (nextCats.length === 0 || nextCats.includes(t.categoryId));
    });
    const validObjs = selectedObjs.filter((id) => {
      const o = objects.find((x) => x.id === id);
      if (!o) return false;
      if (nextCats.length > 0 && !nextCats.includes(o.categoryId)) return false;
      if (validTypes.length > 0 && !validTypes.includes(o.typeId)) return false;
      return true;
    });
    setParams({
      cat: nextCats.length ? nextCats.join(",") : undefined,
      type: validTypes.length ? validTypes.join(",") : undefined,
      obj: validObjs.length ? validObjs.join(",") : undefined,
    });
  }

  // Смена типов: подрезаем выбранные объекты, которые больше не входят в выбор.
  function onTypesChange(nextTypes: string[]) {
    const validObjs = selectedObjs.filter((id) => {
      const o = objects.find((x) => x.id === id);
      if (!o) return false;
      if (selectedCats.length > 0 && !selectedCats.includes(o.categoryId)) return false;
      if (nextTypes.length > 0 && !nextTypes.includes(o.typeId)) return false;
      return true;
    });
    setParams({
      type: nextTypes.length ? nextTypes.join(",") : undefined,
      obj: validObjs.length ? validObjs.join(",") : undefined,
    });
  }

  function onObjsChange(nextObjs: string[]) {
    setParams({ obj: nextObjs.length ? nextObjs.join(",") : undefined });
  }

  const activeCount =
    [current.status, current.q, current.from, current.to].filter(Boolean).length +
    (selectedCats.length ? 1 : 0) +
    (selectedTypes.length ? 1 : 0) +
    (selectedObjs.length ? 1 : 0);

  function applyPreset(from: string, to: string) {
    setParams({ from, to });
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Срез данных</h2>
        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setParams(Object.fromEntries(RESET_KEYS.map((k) => [k, undefined])))}
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Сбросить всё
          </Button>
        )}
      </div>

      {/* Поиск */}
      <div>
        <Label className="text-xs">Поиск</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Объект, имя гостя, телефон или код брони"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Период */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Label className="!mb-0 text-xs">Период</Label>
          <Segment
            options={DATE_FIELD_SEGMENTS}
            value={dateField}
            onChange={(v) => setParams({ dateField: v === "start" ? undefined : v })}
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
          <div>
            <Label className="text-xs">С</Label>
            <Input
              type="date"
              value={current.from ?? ""}
              max={current.to || undefined}
              onChange={(e) => setParams({ from: e.target.value || undefined })}
              className="w-auto"
            />
          </div>
          <div>
            <Label className="text-xs">По</Label>
            <Input
              type="date"
              value={current.to ?? ""}
              min={current.from || undefined}
              onChange={(e) => setParams({ to: e.target.value || undefined })}
              className="w-auto"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => presetThisMonth(applyPreset)}>
              Этот месяц
            </Button>
            <Button variant="outline" size="sm" onClick={() => presetLastMonth(applyPreset)}>
              Прошлый месяц
            </Button>
            <Button variant="outline" size="sm" onClick={() => presetThisYear(applyPreset)}>
              Этот год
            </Button>
            {(current.from || current.to) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setParams({ from: undefined, to: undefined })}
              >
                Сброс
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Категория → Типы → Объекты (множественный выбор) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Категории</Label>
          <MultiSelect
            placeholder="Все категории"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            selected={selectedCats}
            onChange={onCatsChange}
            searchable={categories.length > 8}
          />
        </div>
        <div>
          <Label className="text-xs">Типы объектов</Label>
          <MultiSelect
            placeholder="Все типы"
            options={typesForCategory.map((t) => ({
              value: t.id,
              label: selectedCats.length === 1 ? t.name : `${t.name} · ${t.categoryName}`,
            }))}
            selected={selectedTypes}
            onChange={onTypesChange}
            searchable={typesForCategory.length > 8}
          />
        </div>
        <div>
          <Label className="text-xs">Объекты</Label>
          <MultiSelect
            placeholder="Все объекты"
            options={objectsForSelection.map((o) => ({ value: o.id, label: o.name }))}
            selected={selectedObjs}
            onChange={onObjsChange}
            searchable
          />
        </div>
      </div>

      {/* Статус оплаты (сегмент) */}
      <div className="space-y-1.5">
        <Label className="text-xs">Статус оплаты</Label>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_SEGMENTS.map((s) => {
            const active = (current.status || "") === s.value;
            return (
              <button
                key={s.value || "all"}
                type="button"
                onClick={() => setParams({ status: s.value || undefined })}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-input hover:bg-slate-50",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Маленький сегментированный переключатель (две и более опции). */
function Segment({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-input p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "px-2.5 py-1 rounded text-xs transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function presetThisMonth(apply: (from: string, to: string) => void) {
  const now = new Date();
  apply(ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now));
}

function presetLastMonth(apply: (from: string, to: string) => void) {
  const now = new Date();
  apply(
    ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
  );
}

function presetThisYear(apply: (from: string, to: string) => void) {
  const now = new Date();
  apply(ymd(new Date(now.getFullYear(), 0, 1)), ymd(now));
}
