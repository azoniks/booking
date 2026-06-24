"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PATH = "/admin/bookings";

type TypeOption = { id: string; name: string; categoryName: string };
type ObjectOption = { id: string; name: string; typeId: string };

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

// Ключи фильтров, которые сбрасываются «Сбросить всё» (sort сохраняется).
const FILTER_KEYS = ["q", "type", "obj", "from", "to", "dateField", "status"] as const;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function BookingsFilters({
  types,
  objects,
  current,
}: {
  types: TypeOption[];
  objects: ObjectOption[];
  current: {
    status?: string;
    q?: string;
    type?: string;
    obj?: string;
    from?: string;
    to?: string;
    dateField?: string;
  };
}) {
  const router = useRouter();
  const params = useSearchParams();

  const dateField = current.dateField === "created" ? "created" : "start";

  // Поиск — локальный стейт с дебаунсом, чтобы не дёргать навигацию на каждый символ.
  const [search, setSearch] = useState(current.q ?? "");
  // Синхронизируем поле при внешней смене URL (напр. «Сбросить всё»).
  useEffect(() => {
    setSearch(current.q ?? "");
  }, [current.q]);

  // Копирует текущие параметры, применяет изменения (пустое значение удаляет
  // ключ), сохраняет sort и прочие параметры, переходит на новый URL.
  function setParams(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    const qs = sp.toString();
    router.push(qs ? `${PATH}?${qs}` : PATH);
  }

  // Дебаунс поиска: пушим q через 400мс после остановки ввода.
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

  // Объекты, доступные для выбора: при выбранном типе — только его объекты.
  const objectsForType = useMemo(
    () => (current.type ? objects.filter((o) => o.typeId === current.type) : objects),
    [objects, current.type],
  );

  const activeCount = FILTER_KEYS.filter(
    (k) => k !== "dateField" && (current as Record<string, string | undefined>)[k],
  ).length;

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
            onClick={() =>
              setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))
            }
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

      {/* Тип объекта → Объект */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Тип объекта</Label>
          <select
            value={current.type ?? ""}
            onChange={(e) =>
              // Смена типа сбрасывает выбранный объект.
              setParams({ type: e.target.value || undefined, obj: undefined })
            }
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Все типы</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.categoryName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Объект</Label>
          <select
            value={current.obj ?? ""}
            onChange={(e) => setParams({ obj: e.target.value || undefined })}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Все объекты</option>
            {objectsForType.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
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
