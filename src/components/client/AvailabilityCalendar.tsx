"use client";

import { useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

export type BusyInterval = { kind: "booking" | "block"; startAt: string; endAt: string };

/**
 * Собирает Set дат вида "YYYY-MM-DD" в локальной зоне Europe/Moscow,
 * которые занятые брони перекрывают по «дням ночёвки» (т.е. дата заезда
 * блокируется, дата выезда — не блокируется).
 */
function collectOccupiedDays(intervals: BusyInterval[], cleaningMinutes: number): Set<string> {
  const out = new Set<string>();
  // d * 86_400_000 уже соответствует UTC-полуночи нужного дня MSK-индекса —
  // сдвигать ещё на TZ_OFFSET_MIN не нужно, иначе getUTCDate() уезжает на
  // сутки назад и ключ Set-а перестаёт совпадать с dateKey() в isDisabled.
  const fmt = (dayIdx: number): string => {
    const dt = new Date(dayIdx * 86_400_000);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const day = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  for (const iv of intervals) {
    const start = new Date(iv.startAt);
    const end = new Date(new Date(iv.endAt).getTime() - cleaningMinutes * 60_000);
    const TZ_OFFSET_MIN = 180;
    const startMs = start.getTime() + TZ_OFFSET_MIN * 60_000;
    const endMs = end.getTime() + TZ_OFFSET_MIN * 60_000;
    const startDay = Math.floor(startMs / 86_400_000);
    // Ceil вернул бы +1 для любого endAt НЕ в полночь и блокировал бы
    // лишние сутки (день выезда). Используем floor: занимаем до дня выезда
    // ИСКЛЮЧИТЕЛЬНО — в этот день уже можно заехать новой брони.
    const endDay = Math.floor(endMs / 86_400_000);
    for (let d = startDay; d < endDay; d++) {
      out.add(fmt(d));
    }
    // Если бронь короче суток (start и end в один день) — всё равно
    // пометим день брони занятым, чтобы он не оставался выбираемым.
    if (startDay === endDay) {
      out.add(fmt(startDay));
    }
  }
  return out;
}

function dateKey(d: Date): string {
  // Europe/Moscow tz key
  const TZ_OFFSET_MIN = 180;
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;
}

export function AvailabilityCalendar({
  busy,
  cleaningMinutes,
  range,
  onChange,
}: {
  busy: BusyInterval[];
  cleaningMinutes: number;
  range: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}) {
  const occupied = useMemo(
    () => collectOccupiedDays(busy, cleaningMinutes),
    [busy, cleaningMinutes],
  );

  const isDisabled = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) return true;
    return occupied.has(dateKey(d));
  };

  function handleSelect(next: DateRange | undefined) {
    if (!next?.from || !next.to) {
      onChange(next);
      return;
    }
    // Проверяем нет ли занятых дат внутри диапазона
    const cur = new Date(next.from);
    while (cur < next.to) {
      if (occupied.has(dateKey(cur))) {
        // если внутри есть занятый день — оставить только заезд
        onChange({ from: next.from, to: undefined });
        return;
      }
      cur.setDate(cur.getDate() + 1);
    }
    onChange(next);
  }

  return (
    <div>
      <div className="flex justify-center">
        <DayPicker
          mode="range"
          selected={range}
          onSelect={handleSelect}
          disabled={isDisabled}
          locale={ru}
          weekStartsOn={1}
          showOutsideDays={false}
          numberOfMonths={1}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-[hsl(var(--primary))]" /> выбрано
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-200 line-through" /> занято/прошло
        </span>
      </div>
    </div>
  );
}
