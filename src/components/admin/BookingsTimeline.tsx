"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const TZ_OFFSET_MIN = 180; // Europe/Moscow
const DAY_MS = 86_400_000;
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

type ObjectRow = { id: string; name: string; slug: string; status: string };
type TypeRow = {
  id: string;
  name: string;
  categoryName: string;
  bookingMode: "DAILY" | "HOURLY" | "FULL_DAY";
  cleaningMinutes: number;
  objects: ObjectRow[];
};
type BookingItem = {
  id: string;
  publicCode: string;
  objectId: string;
  startAt: string;
  endAt: string;
  blockedUntil: string;
  status: "PENDING" | "PAID" | string;
  guestName: string;
  guestPhone: string;
  guestsCount: number;
  totalPrice: string;
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

type Mode = "days" | "hours";

export function BookingsTimeline() {
  const [mode, setMode] = useState<Mode>("days");
  const [from, setFrom] = useState(() => isoDate(startOfMonth(new Date())));
  const [to, setTo] = useState(() => isoDate(endOfMonth(new Date())));
  const [data, setData] = useState<{
    types: TypeRow[];
    bookings: BookingItem[];
    blocks: BlockItem[];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    fetch(`/api/admin/timeline?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => {
        if (aborted) return;
        if (j.ok) setData(j.data);
      })
      .finally(() => !aborted && setLoading(false));
    return () => {
      aborted = true;
    };
  }, [from, to]);

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

  // В режиме hours скрываем DAILY-типы — у них некуда ставить часовые брони
  const visibleTypes = useMemo(() => {
    if (!data) return [];
    return mode === "hours"
      ? data.types.filter((t) => t.bookingMode === "HOURLY")
      : data.types;
  }, [data, mode]);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle>Загрузка объектов</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Переключатель режима */}
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
            {/* Навигация по периоду */}
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
          </div>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
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
          <div className="text-xs text-muted-foreground ml-auto flex items-center gap-3 flex-wrap">
            <Legend color="bg-emerald-500" label="оплачено" />
            <Legend color="bg-amber-400" label="ожидает оплаты" />
            <Legend color="bg-slate-400" label="блокировка" />
            {loading && <span>загрузка…</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!data ? (
          <div className="p-6 text-sm text-muted-foreground">Загрузка…</div>
        ) : visibleTypes.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            {mode === "hours"
              ? "Нет почасовых типов объектов."
              : "Объектов пока нет — добавьте через раздел «Объекты»."}
          </div>
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
  const paid = booking.status === "PAID";
  const tooltip = `${booking.publicCode} · ${booking.guestName} · ${booking.guestsCount} гост. · ${booking.totalPrice} ₽\n${formatLocal(booking.startAt)} — ${formatLocal(booking.endAt)}`;
  return (
    <Link
      href={`/admin/bookings/${booking.id}`}
      title={tooltip}
      className={cn(
        "absolute top-1.5 bottom-1.5 rounded-md text-white text-[11px] px-1.5 truncate flex items-center gap-1 cursor-pointer hover:brightness-110 transition-[filter] shadow-sm",
        paid ? "bg-emerald-500" : "bg-amber-500",
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
