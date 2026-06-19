"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn, formatRub } from "@/lib/utils";
import { AdminBookingCreateForm } from "./AdminBookingCreateForm";
import { AdminGroupCreateFormSheet } from "./AdminGroupCreateFormSheet";

type SingleFormObjects = React.ComponentProps<typeof AdminBookingCreateForm>["objects"];
type GroupFormObjects = React.ComponentProps<typeof AdminGroupCreateFormSheet>["objects"];

const TZ_OFFSET_MIN = 180; // Europe/Moscow
const DAY_MS = 86_400_000;
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

type ObjectRow = { id: string; name: string; slug: string; status: string };
type TypeRow = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  bookingMode: "DAILY" | "HOURLY" | "FULL_DAY";
  cleaningMinutes: number;
  baseCapacity: number;
  basePrice: number;
  objects: ObjectRow[];
};

// Сортировка строк-объектов в шахматке. Вместимость и цена задаются на типе,
// поэтому по ним сортируются группы типов; объекты внутри — по имени.
type TimelineSort =
  | "default"
  | "name-asc"
  | "name-desc"
  | "cap-desc"
  | "cap-asc"
  | "price-desc"
  | "price-asc";

const TIMELINE_SORT_OPTIONS: { value: TimelineSort; label: string }[] = [
  { value: "default", label: "По умолчанию (категория)" },
  { value: "name-asc", label: "Название: А–Я" },
  { value: "name-desc", label: "Название: Я–А" },
  { value: "cap-desc", label: "Вместимость: больше → меньше" },
  { value: "cap-asc", label: "Вместимость: меньше → больше" },
  { value: "price-desc", label: "Цена: больше → меньше" },
  { value: "price-asc", label: "Цена: меньше → больше" },
];

function cmpRu(a: string, b: string): number {
  return a.localeCompare(b, "ru", { numeric: true, sensitivity: "base" });
}

// Возвращает отсортированный список типов с отсортированными объектами внутри.
function sortTimelineTypes(types: TypeRow[], sort: TimelineSort): TypeRow[] {
  if (sort === "default") return types;
  const withObjects = types.map((t) => {
    const objects = [...t.objects];
    if (sort === "name-desc") objects.sort((a, b) => cmpRu(b.name, a.name));
    else objects.sort((a, b) => cmpRu(a.name, b.name));
    return { ...t, objects };
  });
  const typeName = (t: TypeRow) => `${t.categoryName} · ${t.name}`;
  switch (sort) {
    case "name-asc":
      return withObjects.sort((a, b) => cmpRu(typeName(a), typeName(b)));
    case "name-desc":
      return withObjects.sort((a, b) => cmpRu(typeName(b), typeName(a)));
    case "cap-desc":
      return withObjects.sort(
        (a, b) => b.baseCapacity - a.baseCapacity || cmpRu(typeName(a), typeName(b)),
      );
    case "cap-asc":
      return withObjects.sort(
        (a, b) => a.baseCapacity - b.baseCapacity || cmpRu(typeName(a), typeName(b)),
      );
    case "price-desc":
      return withObjects.sort(
        (a, b) => b.basePrice - a.basePrice || cmpRu(typeName(a), typeName(b)),
      );
    case "price-asc":
      return withObjects.sort(
        (a, b) => a.basePrice - b.basePrice || cmpRu(typeName(a), typeName(b)),
      );
    default:
      return withObjects;
  }
}
type BookingItem = {
  id: string;
  publicCode: string;
  objectId: string;
  startAt: string;
  endAt: string;
  blockedUntil: string;
  status: "PENDING" | "PREPAID" | "PAID" | string;
  guestName: string;
  guestPhone: string;
  guestComment: string | null;
  guestsCount: number;
  totalPrice: string;
  groupId: string | null;
  group: { publicCode: string; status: string; totalPrice: string } | null;
};
type BlockItem = {
  id: string;
  objectId: string;
  startAt: string;
  endAt: string;
  reason: string | null;
};

function isoDate(d: Date): string {
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  return local.toISOString().slice(0, 10);
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function todayLocal() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function plural(n: number, forms: [string, string, string]) {
  const n10 = Math.abs(n) % 10;
  const n100 = Math.abs(n) % 100;
  if (n100 >= 11 && n100 <= 19) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}

type Mode = "days" | "hours";
type View = "auto" | "table" | "list";

export function BookingsTimeline({
  singleFormObjects = [],
  groupFormObjects = [],
}: {
  // Объекты для форм создания брони из мобильного списка (опц. — без них кнопки
  // создания не показываем).
  singleFormObjects?: SingleFormObjects;
  groupFormObjects?: GroupFormObjects;
} = {}) {
  const [mode, setMode] = useState<Mode>("days");
  // Представление: на узких экранах шахматка нечитаема — показываем список дат.
  // "auto" выбирает по ширине, table/list форсируют вид вручную.
  const [view, setView] = useState<View>("auto");
  const [isWide, setIsWide] = useState(true);
  const [from, setFrom] = useState(() => isoDate(startOfMonth(new Date())));
  const [to, setTo] = useState(() => isoDate(endOfMonth(new Date())));
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);
  const [sort, setSort] = useState<TimelineSort>("default");
  const [data, setData] = useState<{
    types: TypeRow[];
    bookings: BookingItem[];
    blocks: BlockItem[];
  } | null>(null);

  useEffect(() => {
    let aborted = false;
    fetch(`/api/admin/timeline?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => {
        if (aborted) return;
        if (j.ok) setData(j.data);
      });
    return () => {
      aborted = true;
    };
  }, [from, to]);

  // Отслеживаем ширину экрана для "auto"-режима (md = 768px).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(min-width: 768px)");
    const apply = () => setIsWide(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  const effectiveView: "table" | "list" =
    view === "auto" ? (isWide ? "table" : "list") : view;

  // Список всегда дневной (часового представления списка нет). Если попали в
  // список из часового режима — в т.ч. авто на узком экране — сбрасываем mode,
  // чтобы навигация по периоду была месячной, а не «сегодня/+завтра».
  useEffect(() => {
    if (effectiveView === "list" && mode === "hours") {
      setMode("days");
      setFrom(isoDate(startOfMonth(new Date())));
      setTo(isoDate(endOfMonth(new Date())));
    }
  }, [effectiveView, mode]);

  // Дни в окне (по локальной зоне)
  const days = useMemo(() => {
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T00:00:00`);
    const arr: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      arr.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return arr;
  }, [from, to]);

  // Часы в окне (только для режима hours)
  const hours = useMemo(() => {
    if (mode !== "hours") return [] as Date[];
    const start = new Date(`${from}T00:00:00`);
    const end = new Date(`${to}T23:00:00`);
    const arr: Date[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      arr.push(new Date(cur));
      cur.setHours(cur.getHours() + 1);
    }
    return arr;
  }, [from, to, mode]);

  // Ширина одной единицы (день или час) в px
  const dayPx = days.length > 90 ? 14 : days.length > 45 ? 22 : days.length > 14 ? 32 : 56;
  const hourPx = hours.length > 96 ? 22 : hours.length > 48 ? 32 : 50;
  const totalPx = mode === "days" ? dayPx * days.length : hourPx * hours.length;

  // Преобразуем дату в позицию (px) от начала окна (в локальной зоне)
  function leftPxFor(iso: string): number {
    const utc = new Date(iso).getTime();
    const localStart = new Date(`${from}T00:00:00`).getTime();
    const offsetMs = utc - localStart;
    if (mode === "days") return (offsetMs / DAY_MS) * dayPx;
    return (offsetMs / 3_600_000) * hourPx;
  }

  function shiftPeriod(deltaUnits: number) {
    const deltaMs = mode === "days" ? deltaUnits * DAY_MS : deltaUnits * 3_600_000;
    setFrom(isoDate(new Date(new Date(`${from}T00:00:00`).getTime() + deltaMs)));
    setTo(isoDate(new Date(new Date(`${to}T00:00:00`).getTime() + deltaMs)));
  }

  function setMonth(offset: number) {
    const base = new Date();
    base.setMonth(base.getMonth() + offset);
    setFrom(isoDate(startOfMonth(base)));
    setTo(isoDate(endOfMonth(base)));
  }

  function applyMode(next: Mode) {
    setMode(next);
    if (next === "hours") {
      // По умолчанию — сегодня (один день)
      const t = todayLocal();
      setFrom(isoDate(t));
      setTo(isoDate(t));
    } else {
      setFrom(isoDate(startOfMonth(new Date())));
      setTo(isoDate(endOfMonth(new Date())));
    }
  }

  const todayLeft = (() => {
    const now = mode === "hours" ? new Date() : todayLocal();
    const f = new Date(`${from}T00:00:00`);
    const e = new Date(`${to}T23:59:59`);
    if (now < f || now > e) return null;
    return leftPxFor(now.toISOString());
  })();

  // Базовый список типов с учётом режима:
  // в режиме hours скрываем DAILY-типы — у них некуда ставить часовые брони
  const baseTypes = useMemo(() => {
    if (!data) return [];
    return mode === "hours"
      ? data.types.filter((t) => t.bookingMode === "HOURLY")
      : data.types;
  }, [data, mode]);

  // Уникальные категории и виды объектов (для фильтров).
  // Виды сужаются выбранными категориями.
  const catOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of baseTypes) if (!seen.has(t.categoryId)) seen.set(t.categoryId, t.categoryName);
    return Array.from(seen, ([id, label]) => ({ id, label }));
  }, [baseTypes]);

  const typeOptions = useMemo(() => {
    const inCats =
      selectedCats.length > 0
        ? baseTypes.filter((t) => selectedCats.includes(t.categoryId))
        : baseTypes;
    return inCats.map((t) => ({ id: t.id, label: `${t.categoryName} · ${t.name}` }));
  }, [baseTypes, selectedCats]);

  // Итоговый список строк с применёнными фильтрами (категория И вид — через AND)
  // и выбранной сортировкой.
  const visibleTypes = useMemo(() => {
    let result = baseTypes;
    if (selectedCats.length > 0) result = result.filter((t) => selectedCats.includes(t.categoryId));
    if (selectedTypeIds.length > 0) result = result.filter((t) => selectedTypeIds.includes(t.id));
    return sortTimelineTypes(result, sort);
  }, [baseTypes, selectedCats, selectedTypeIds, sort]);

  const filtersActive = selectedCats.length > 0 || selectedTypeIds.length > 0;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Загрузка объектов</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Переключатель представления: авто / таблица / список */}
            <div className="inline-flex rounded-md border overflow-hidden text-sm">
              <button
                type="button"
                onClick={() => setView("auto")}
                className={cn(
                  "px-3 py-1.5",
                  view === "auto" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50",
                )}
              >
                Авто
              </button>
              <button
                type="button"
                onClick={() => setView("table")}
                className={cn(
                  "px-3 py-1.5 border-l",
                  view === "table" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50",
                )}
              >
                Таблица
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                className={cn(
                  "px-3 py-1.5 border-l",
                  view === "list" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50",
                )}
              >
                Список
              </button>
            </div>
            {/* Переключатель режима «дни/часы» — в списке не нужен */}
            {effectiveView !== "list" && (
              <div className="inline-flex rounded-md border overflow-hidden text-sm">
                <button
                  type="button"
                  onClick={() => applyMode("days")}
                  className={cn(
                    "px-3 py-1.5",
                    mode === "days" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50",
                  )}
                >
                  По дням
                </button>
                <button
                  type="button"
                  onClick={() => applyMode("hours")}
                  className={cn(
                    "px-3 py-1.5 border-l",
                    mode === "hours" ? "bg-primary text-primary-foreground" : "bg-white hover:bg-slate-50",
                  )}
                >
                  По часам
                </button>
              </div>
            )}
            {/* Навигация по периоду — в списке заменяется простым выбором месяца */}
            {effectiveView === "list" ? (
              <MonthSelect from={from} onPick={setMonth} />
            ) : (
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    shiftPeriod(mode === "days" ? -days.length : -hours.length)
                  }
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {mode === "days" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setMonth(-1)}>
                      Прошлый месяц
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setMonth(0)}>
                      Этот месяц
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setMonth(1)}>
                      Следующий
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const t = todayLocal();
                        setFrom(isoDate(t));
                        setTo(isoDate(t));
                      }}
                    >
                      Сегодня
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const t = todayLocal();
                        const tomorrow = new Date(t);
                        tomorrow.setDate(t.getDate() + 1);
                        setFrom(isoDate(t));
                        setTo(isoDate(tomorrow));
                      }}
                    >
                      Сегодня + завтра
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    shiftPeriod(mode === "days" ? days.length : hours.length)
                  }
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          {/* Инпуты дат «С/По» — в списке скрыты, период задаётся выбором месяца */}
          {effectiveView !== "list" && (
            <>
              <div>
                <Label className="text-xs">С</Label>
                <Input
                  type="date"
                  value={from}
                  max={to}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-44"
                />
              </div>
              <div>
                <Label className="text-xs">По</Label>
                <Input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-44"
                />
              </div>
            </>
          )}
          {/* Сортировка строк-объектов — доступна и в списочном режиме на мобиле */}
          <div>
            <Label className="text-xs">Сортировка</Label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as TimelineSort)}
              className="h-9 w-full sm:w-auto rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {TIMELINE_SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {/* Фильтры по категориям и видам объектов — на мобиле скрыты */}
          <div className="hidden sm:flex items-end gap-2 flex-wrap">
            <MultiSelectFilter
              label="Категории"
              options={catOptions}
              selected={selectedCats}
              onChange={(next) => {
                setSelectedCats(next);
                // убираем виды, не относящиеся к выбранным категориям
                if (next.length > 0 && data) {
                  const allowed = new Set(
                    data.types.filter((t) => next.includes(t.categoryId)).map((t) => t.id),
                  );
                  setSelectedTypeIds((prev) => prev.filter((id) => allowed.has(id)));
                }
              }}
            />
            <MultiSelectFilter
              label="Виды объектов"
              options={typeOptions}
              selected={selectedTypeIds}
              onChange={setSelectedTypeIds}
            />
            {filtersActive && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedCats([]);
                  setSelectedTypeIds([]);
                }}
              >
                Сбросить фильтры
              </Button>
            )}
          </div>
          {/* Легенда цветов — в списке не нужна (статусы видны на карточках) */}
          {effectiveView !== "list" && (
            <div className="text-xs text-muted-foreground ml-auto flex items-center gap-3 flex-wrap">
              <Legend color="bg-emerald-500" label="оплачено" />
              <Legend color="bg-blue-500" label="аванс внесён" />
              <Legend color="bg-amber-400" label="ожидает оплаты" />
              <Legend color="bg-slate-400" label="блокировка" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!data ? (
          <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>
        ) : visibleTypes.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            {filtersActive
              ? "Нет объектов под выбранные фильтры."
              : mode === "hours"
                ? "Нет почасовых типов объектов."
                : "Объектов пока нет — добавьте через раздел «Объекты»."}
          </div>
        ) : effectiveView === "list" ? (
          <MobileDayList
            days={days}
            mode={mode}
            visibleTypes={visibleTypes}
            bookings={data.bookings}
            blocks={data.blocks}
            singleFormObjects={singleFormObjects}
            groupFormObjects={groupFormObjects}
          />
        ) : (
          <div className="flex border-t">
            {/* Левая колонка: типы и объекты */}
            <div className="w-56 sm:w-64 shrink-0 border-r bg-white">
              <div className="h-12 border-b" />
              {visibleTypes.map((t) => (
                <div key={t.id}>
                  <div className="h-8 px-3 flex items-center bg-slate-100 text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b">
                    <span className="truncate">{t.categoryName} · {t.name}</span>
                  </div>
                  {t.objects.map((o) => (
                    <div
                      key={o.id}
                      className="h-12 px-3 flex items-center text-sm border-b"
                    >
                      <span className="truncate">{o.name}</span>
                      {o.status !== "ACTIVE" && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({o.status === "HIDDEN" ? "скрыт" : "обслуж."})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Правая часть: горизонтально-скроллируемая шахматка */}
            <div className="flex-1 overflow-x-auto relative">
              <div style={{ width: totalPx, minWidth: "100%" }} className="relative">
                {/* Шапка: дни или часы */}
                {mode === "days" ? (
                  <div className="flex h-12 border-b sticky top-0 bg-white z-10">
                    {days.map((d) => {
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isToday = dayKey(d) === dayKey(todayLocal());
                      return (
                        <div
                          key={d.toISOString()}
                          style={{ width: dayPx }}
                          className={cn(
                            "shrink-0 text-center text-[11px] leading-tight border-r flex flex-col justify-center",
                            isWeekend && "bg-slate-50 text-rose-600",
                            isToday && "bg-amber-100 font-bold",
                          )}
                        >
                          <div>{d.getDate()}</div>
                          <div className="text-muted-foreground">{WEEKDAYS[d.getDay()]}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-12 border-b sticky top-0 bg-white z-10">
                    {hours.map((h, i) => {
                      const isMidnight = h.getHours() === 0;
                      const isNoon = h.getHours() === 12;
                      const isCurrent =
                        h.getFullYear() === new Date().getFullYear() &&
                        h.getMonth() === new Date().getMonth() &&
                        h.getDate() === new Date().getDate() &&
                        h.getHours() === new Date().getHours();
                      return (
                        <div
                          key={h.toISOString()}
                          style={{ width: hourPx }}
                          className={cn(
                            "shrink-0 text-center text-[11px] leading-tight border-r flex flex-col justify-center",
                            (isMidnight || isNoon) && "bg-slate-50",
                            isCurrent && "bg-amber-100 font-bold",
                          )}
                        >
                          <div className="font-medium">
                            {String(h.getHours()).padStart(2, "0")}
                          </div>
                          {(i === 0 || isMidnight) && (
                            <div className="text-muted-foreground text-[10px]">
                              {h.getDate()}.{String(h.getMonth() + 1).padStart(2, "0")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Линия "сейчас" */}
                {todayLeft !== null && (
                  <div
                    className="absolute top-12 bottom-0 w-px bg-amber-500/70 pointer-events-none z-[5]"
                    style={{ left: todayLeft }}
                  />
                )}

                {/* Строки объектов */}
                {visibleTypes.map((t) => (
                  <div key={t.id}>
                    {/* spacer соответствует заголовку категории слева */}
                    <div className="h-8 bg-slate-100 border-b" />
                    {t.objects.map((o) => {
                      const items = data.bookings.filter((b) => b.objectId === o.id);
                      const objBlocks = data.blocks.filter((b) => b.objectId === o.id);
                      return (
                        <div key={o.id} className="relative h-12 border-b">
                          {/* фон с подсветкой выходных / границами часов */}
                          <div className="absolute inset-0 flex">
                            {mode === "days"
                              ? days.map((d) => (
                                  <div
                                    key={d.toISOString()}
                                    style={{ width: dayPx }}
                                    className={cn(
                                      "shrink-0 border-r border-slate-100",
                                      (d.getDay() === 0 || d.getDay() === 6) && "bg-slate-50/70",
                                    )}
                                  />
                                ))
                              : hours.map((h) => (
                                  <div
                                    key={h.toISOString()}
                                    style={{ width: hourPx }}
                                    className={cn(
                                      "shrink-0 border-r border-slate-100",
                                      h.getHours() === 0 && "border-r-slate-300",
                                      // ночь подкрашиваем
                                      (h.getHours() < 6 || h.getHours() >= 22) && "bg-slate-50/60",
                                    )}
                                  />
                                ))}
                          </div>
                          {/* блокировки */}
                          {objBlocks.map((b) => (
                            <BarBlock
                              key={b.id}
                              left={leftPxFor(b.startAt)}
                              width={Math.max(2, leftPxFor(b.endAt) - leftPxFor(b.startAt))}
                              reason={b.reason ?? "блокировка"}
                            />
                          ))}
                          {/* брони */}
                          {items.map((b) => (
                            <BarBooking
                              key={b.id}
                              booking={b}
                              left={leftPxFor(b.startAt)}
                              width={Math.max(
                                mode === "hours" ? 12 : 4,
                                leftPxFor(b.blockedUntil) - leftPxFor(b.startAt),
                              )}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Простой выбор месяца для списочного режима: один <select> вместо календаря,
// стрелок и кнопок листания. onPick получает offset месяцев относительно текущего
// (та же сигнатура, что и у setMonth в основном компоненте).
function MonthSelect({
  from,
  onPick,
}: {
  from: string;
  onPick: (offset: number) => void;
}) {
  // offset выбранного месяца относительно текущего — чтобы select отражал состояние.
  const now = new Date();
  const sel = new Date(`${from}T00:00:00`);
  const selectedOffset =
    (sel.getFullYear() - now.getFullYear()) * 12 + (sel.getMonth() - now.getMonth());

  // Диапазон месяцев: 3 назад … 9 вперёд. Если текущий выбор (с десктопа) вне
  // диапазона — добавляем его, чтобы select корректно его показал.
  const offsets: number[] = [];
  for (let o = -3; o <= 9; o++) offsets.push(o);
  if (!offsets.includes(selectedOffset)) {
    offsets.push(selectedOffset);
    offsets.sort((a, b) => a - b);
  }

  return (
    <select
      value={selectedOffset}
      onChange={(e) => onPick(Number(e.target.value))}
      className="h-9 rounded-md border border-input bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {offsets.map((o) => {
        const d = new Date(now.getFullYear(), now.getMonth() + o, 1);
        const label = d.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
        return (
          <option key={o} value={o}>
            {label[0].toUpperCase() + label.slice(1)}
            {o === 0 ? " (текущий)" : ""}
          </option>
        );
      })}
    </select>
  );
}

// Границы дня d в UTC-миллисекундах. d — локальная полночь (из массива days),
// поэтому d.getTime() уже соответствует нужному UTC-моменту начала дня — так же,
// как leftPxFor выше считает позицию от new Date(`${from}T00:00:00`).getTime().
function localDayBounds(d: Date): { startUtc: number; endUtc: number } {
  const startUtc = d.getTime();
  return { startUtc, endUtc: startUtc + DAY_MS };
}

// Попадает ли UTC-момент aMs в тот же календарный день, что и граница startUtc
// (startUtc — локальная полночь дня). Сравниваем по окну [startUtc, startUtc+DAY).
function isSameDayWindow(aMs: number, startUtc: number): boolean {
  return aMs >= startUtc && aMs < startUtc + DAY_MS;
}

type DayRole = "checkin" | "during" | "checkout" | "single";

const ROLE_LABEL: Record<DayRole, string> = {
  checkin: "заезд",
  during: "проживание",
  checkout: "выезд",
  single: "весь день",
};

function timeLocal(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

// Блок списка дня: брони одного заказа вместе, остальные — по одной.
type DayBlock =
  | { kind: "single"; booking: BookingItem }
  | { kind: "group"; groupId: string; bookings: BookingItem[] };

// Группируем брони дня по заказам (порядок сохраняется по первой встрече).
function groupDayBookings(items: BookingItem[]): DayBlock[] {
  const blocks: DayBlock[] = [];
  const pos = new Map<string, number>();
  for (const b of items) {
    if (b.groupId) {
      const idx = pos.get(b.groupId);
      if (idx === undefined) {
        pos.set(b.groupId, blocks.length);
        blocks.push({ kind: "group", groupId: b.groupId, bookings: [b] });
      } else {
        (blocks[idx] as Extract<DayBlock, { kind: "group" }>).bookings.push(b);
      }
    } else {
      blocks.push({ kind: "single", booking: b });
    }
  }
  return blocks;
}

function computeDayRole(b: BookingItem, startUtc: number, mode: Mode): DayRole {
  if (mode === "hours") return "single";
  const isCheckIn = isSameDayWindow(new Date(b.startAt).getTime(), startUtc);
  const isCheckOut = isSameDayWindow(new Date(b.endAt).getTime(), startUtc);
  if (isCheckIn && isCheckOut) return "single";
  if (isCheckIn) return "checkin";
  if (isCheckOut) return "checkout";
  return "during";
}

const PAY_BADGE: Record<
  string,
  { label: string; variant: "secondary" | "destructive" | "outline" | "success" | "successSolid" | "warning" | "info" }
> = {
  PENDING: { label: "Ожидает оплаты", variant: "warning" },
  PREPAID: { label: "Аванс внесён", variant: "info" },
  PAID: { label: "Оплачено", variant: "successSolid" },
  CANCELLED: { label: "Отменено", variant: "destructive" },
  COMPLETED: { label: "Завершено", variant: "success" },
  NO_SHOW: { label: "Не пришёл", variant: "destructive" },
};

function PayBadge({ status }: { status: string }) {
  const cfg = PAY_BADGE[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

// Карточка одной брони в списке дня. inGroup — компактный вид внутри блока заказа
// (статус/гость/комментарий показываются на уровне заказа).
function DayBookingRow({
  b,
  objectName,
  startUtc,
  mode,
  inGroup = false,
}: {
  b: BookingItem;
  objectName: string;
  startUtc: number;
  mode: Mode;
  inGroup?: boolean;
}) {
  const role = computeDayRole(b, startUtc, mode);
  const paid = b.status === "PAID";
  const prepaid = b.status === "PREPAID";
  return (
    <Link
      href={`/admin/bookings/${b.id}`}
      className="flex items-start gap-2 rounded-md border bg-white p-2.5 text-sm hover:bg-slate-50 transition-colors"
    >
      <span
        className={cn(
          "w-2 h-2 rounded-full shrink-0 mt-1.5",
          inGroup
            ? "bg-slate-300"
            : paid
              ? "bg-emerald-500"
              : prepaid
                ? "bg-blue-500"
                : "bg-amber-500",
        )}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{objectName}</span>
          <span className="font-mono text-xs text-muted-foreground">{b.publicCode}</span>
          <span
            className={cn(
              "text-[11px] rounded px-1.5 py-0.5",
              role === "checkin" && "bg-emerald-50 text-emerald-700",
              role === "checkout" && "bg-rose-50 text-rose-600",
              (role === "during" || role === "single") && "bg-slate-100 text-slate-600",
            )}
          >
            {mode === "hours"
              ? `${timeLocal(b.startAt)}–${timeLocal(b.endAt)}`
              : ROLE_LABEL[role]}
          </span>
          <span className="ml-auto font-medium shrink-0">{formatRub(b.totalPrice)}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          Заезд: {formatLocal(b.startAt)} · Выезд: {formatLocal(b.endAt)}
        </div>
        {inGroup ? (
          <div className="text-xs text-muted-foreground">{b.guestsCount} гост.</div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
              Статус оплаты: <PayBadge status={b.status} />
            </div>
            <div className="text-xs text-muted-foreground">
              Гость: {b.guestName} · {b.guestsCount} гост.
            </div>
            {b.guestComment && (
              <div className="text-xs text-muted-foreground">
                Комментарий: <span className="italic">«{b.guestComment}»</span>
              </div>
            )}
          </>
        )}
      </div>
    </Link>
  );
}

// Блок группового заказа в списке дня: шапка с кодом, статусом оплаты и суммой
// заказа, затем входящие в него брони этого дня.
function DayGroupBlock({
  bookings,
  objName,
  startUtc,
  mode,
}: {
  bookings: BookingItem[];
  objName: Map<string, string>;
  startUtc: number;
  mode: Mode;
}) {
  const g = bookings[0].group;
  const guestName = bookings[0].guestName;
  const comment = bookings.find((b) => b.guestComment)?.guestComment ?? null;
  return (
    <div className="rounded-md border border-primary/40 bg-primary/[0.03] p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <Badge variant="secondary">Заказ</Badge>
          {g && <span className="font-mono text-xs font-semibold">{g.publicCode}</span>}
          {g && <PayBadge status={g.status} />}
          <span className="text-xs text-muted-foreground">{bookings.length} объ.</span>
        </div>
        {g && <span className="text-sm font-semibold">{formatRub(g.totalPrice)}</span>}
      </div>
      <div className="text-xs text-muted-foreground">Гость: {guestName}</div>
      {comment && (
        <div className="text-xs text-muted-foreground">
          Комментарий: <span className="italic">«{comment}»</span>
        </div>
      )}
      <div className="space-y-1.5">
        {bookings.map((b) => (
          <DayBookingRow
            key={b.id}
            b={b}
            objectName={objName.get(b.objectId) ?? "Объект"}
            startUtc={startUtc}
            mode={mode}
            inGroup
          />
        ))}
      </div>
    </div>
  );
}

function MobileDayList({
  days,
  mode,
  visibleTypes,
  bookings,
  blocks,
  singleFormObjects,
  groupFormObjects,
}: {
  days: Date[];
  mode: Mode;
  visibleTypes: TypeRow[];
  bookings: BookingItem[];
  blocks: BlockItem[];
  singleFormObjects: SingleFormObjects;
  groupFormObjects: GroupFormObjects;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // По умолчанию раскрываем сегодняшний день, если он в окне.
    const todayKey = dayKey(todayLocal());
    return new Set(days.some((d) => dayKey(d) === todayKey) ? [todayKey] : []);
  });

  // Создание брони с конкретной даты: открытая форма + выбранный день (YYYY-MM-DD).
  const [singleOpen, setSingleOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const canCreate = singleFormObjects.length > 0 || groupFormObjects.length > 0;

  // YYYY-MM-DD локального дня списка (d — локальная полночь).
  function dayISO(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function openSingle(d: Date) {
    setPendingDate(dayISO(d));
    setSingleOpen(true);
  }
  function openGroup(d: Date) {
    setPendingDate(dayISO(d));
    setGroupOpen(true);
  }

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Имя объекта по id (для подписи в карточке).
  const objName = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of visibleTypes) for (const o of t.objects) m.set(o.id, o.name);
    return m;
  }, [visibleTypes]);

  // Множество id объектов, попавших под фильтры (брони/блоки чужих объектов скрываем).
  const visibleObjIds = useMemo(() => {
    const s = new Set<string>();
    for (const t of visibleTypes) for (const o of t.objects) s.add(o.id);
    return s;
  }, [visibleTypes]);

  return (
    <div className="divide-y border-t">
      {days.map((d) => {
        const { startUtc, endUtc } = localDayBounds(d);
        // Брони, перекрывающие этот день по [startAt, endAt] включительно
        // (день выезда тоже показываем).
        const dayBookings = bookings.filter((b) => {
          if (!visibleObjIds.has(b.objectId)) return false;
          const s = new Date(b.startAt).getTime();
          const e = new Date(b.endAt).getTime();
          return s < endUtc && e > startUtc;
        });
        const dayBlocks = blocks.filter((b) => {
          if (!visibleObjIds.has(b.objectId)) return false;
          const s = new Date(b.startAt).getTime();
          const e = new Date(b.endAt).getTime();
          return s < endUtc && e > startUtc;
        });
        const count = dayBookings.length + dayBlocks.length;
        const isToday = dayKey(d) === dayKey(todayLocal());
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const key = dayKey(d);
        const isOpen = expanded.has(key);

        return (
          <div key={key}>
            <div
              className={cn(
                "flex items-center gap-2 pl-4 pr-3 py-3",
                isToday && "bg-amber-50",
              )}
            >
              <button
                type="button"
                onClick={() => toggle(key)}
                className="flex flex-1 min-w-0 items-center gap-3 text-left"
              >
                <div className="flex flex-col items-center justify-center w-12 shrink-0">
                  <span
                    className={cn(
                      "text-lg font-semibold leading-none",
                      isWeekend && "text-rose-600",
                      isToday && "text-amber-700",
                    )}
                  >
                    {d.getDate()}
                  </span>
                  <span className="text-[11px] text-muted-foreground uppercase">
                    {WEEKDAYS[d.getDay()]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">
                    {d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                  </div>
                  {count === 0 ? (
                    <span className="inline-block mt-0.5 text-xs rounded px-1.5 py-0.5 bg-emerald-50 text-emerald-700">
                      свободно
                    </span>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      {dayBookings.length > 0 && `${dayBookings.length} ${plural(dayBookings.length, ["бронь", "брони", "броней"])}`}
                      {dayBookings.length > 0 && dayBlocks.length > 0 && " · "}
                      {dayBlocks.length > 0 && `${dayBlocks.length} ${plural(dayBlocks.length, ["блокировка", "блокировки", "блокировок"])}`}
                    </div>
                  )}
                </div>
                <ChevronDown
                  className={cn(
                    "w-5 h-5 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {/* Действия: создать одиночную / групповую бронь на этот день */}
              {canCreate && (
                <div className="flex items-center gap-1 shrink-0">
                  {singleFormObjects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openSingle(d)}
                      aria-label="Новая бронь на этот день"
                      title="Новая бронь"
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md border bg-white text-foreground hover:bg-slate-50"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  {groupFormObjects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openGroup(d)}
                      aria-label="Групповой заказ на этот день"
                      title="Групповой заказ"
                      className="inline-flex items-center justify-center h-8 w-8 rounded-md border bg-white text-foreground hover:bg-slate-50"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {isOpen && count > 0 && (
              <div className="px-4 pb-3 space-y-2 bg-slate-50/60">
                {dayBlocks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-2 rounded-md border bg-white p-2.5 text-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                    <span className="font-medium truncate">{objName.get(b.objectId) ?? "Объект"}</span>
                    <span className="text-muted-foreground truncate">
                      · блокировка{b.reason ? `: ${b.reason}` : ""}
                    </span>
                  </div>
                ))}
                {groupDayBookings(dayBookings).map((blk) =>
                  blk.kind === "group" ? (
                    <DayGroupBlock
                      key={blk.groupId}
                      bookings={blk.bookings}
                      objName={objName}
                      startUtc={startUtc}
                      mode={mode}
                    />
                  ) : (
                    <DayBookingRow
                      key={blk.booking.id}
                      b={blk.booking}
                      objectName={objName.get(blk.booking.objectId) ?? "Объект"}
                      startUtc={startUtc}
                      mode={mode}
                    />
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Управляемые формы создания — один экземпляр на список, дата из pendingDate */}
      {singleFormObjects.length > 0 && (
        <AdminBookingCreateForm
          objects={singleFormObjects}
          hideTrigger
          open={singleOpen}
          onOpenChange={setSingleOpen}
          initialDate={pendingDate ?? undefined}
        />
      )}
      {groupFormObjects.length > 0 && (
        <AdminGroupCreateFormSheet
          objects={groupFormObjects}
          open={groupOpen}
          onOpenChange={setGroupOpen}
          initialDate={pendingDate ?? undefined}
        />
      )}
    </div>
  );
}

function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = selected.length;
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }
  return (
    <div className="relative">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen((o) => !o)}
        className={cn(count > 0 && "border-primary text-primary")}
      >
        {label}
        {count > 0 && ` · ${count}`}
        <ChevronDown className="w-3.5 h-3.5 ml-1" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1 z-30 w-60 max-h-72 overflow-auto rounded-md border bg-white shadow-lg p-1 text-sm">
            {count > 0 && (
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-50 text-muted-foreground"
                onClick={() => onChange([])}
              >
                Сбросить
              </button>
            )}
            {options.length === 0 ? (
              <div className="px-2 py-1.5 text-muted-foreground">Нет вариантов</div>
            ) : (
              options.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.id)}
                    onChange={() => toggle(opt.id)}
                  />
                  <span className="truncate">{opt.label}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block w-3 h-3 rounded-sm", color)} />
      <span>{label}</span>
    </span>
  );
}

function BarBooking({
  booking,
  left,
  width,
}: {
  booking: BookingItem;
  left: number;
  width: number;
}) {
  const prepaid = booking.status === "PREPAID";
  const paid = booking.status === "PAID";
  const tooltip = `${booking.publicCode} · ${booking.guestName} · ${booking.guestsCount} гост. · ${booking.totalPrice} ₽\n${formatLocal(booking.startAt)} — ${formatLocal(booking.endAt)}`;
  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      title={tooltip}
      className={cn(
        "absolute top-1.5 bottom-1.5 rounded-md text-white text-[11px] px-1.5 truncate flex items-center gap-1 cursor-pointer hover:brightness-110 transition-[filter] shadow-sm",
        paid ? "bg-emerald-500" : prepaid ? "bg-blue-500" : "bg-amber-500",
      )}
      style={{ left, width }}
    >
      <span className="font-medium">{booking.publicCode}</span>
      {width > 80 && <span className="opacity-90 truncate">· {booking.guestName}</span>}
    </Link>
  );
}

function BarBlock({
  left,
  width,
  reason,
}: {
  left: number;
  width: number;
  reason: string;
}) {
  return (
    <div
      title={`Блокировка: ${reason}`}
      className="absolute top-1.5 bottom-1.5 rounded-md bg-slate-400 text-[11px] text-white px-1.5 truncate flex items-center"
      style={{
        left,
        width,
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(255,255,255,0.15), rgba(255,255,255,0.15) 4px, transparent 4px, transparent 8px)",
      }}
    >
      {width > 60 && <span className="truncate">{reason}</span>}
    </div>
  );
}

function formatLocal(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  const D = String(local.getUTCDate()).padStart(2, "0");
  const M = String(local.getUTCMonth() + 1).padStart(2, "0");
  const Y = local.getUTCFullYear();
  const h = String(local.getUTCHours()).padStart(2, "0");
  const m = String(local.getUTCMinutes()).padStart(2, "0");
  return `${D}.${M}.${Y} ${h}:${m}`;
}
