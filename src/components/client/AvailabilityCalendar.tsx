"use client";

import { useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  type BusyInterval,
  dateKey,
  firstOccupiedNightFrom,
  mskDayIndex,
  occupiedNightIndices,
  rangeHitsOccupiedNight,
} from "@/lib/day-availability";

export type { BusyInterval };

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
  // Индексы занятых НОЧЕЙ. День выезда чужой брони сюда не входит — в него можно
  // заехать; день заезда чужой брони входит — но его можно выбрать как дату
  // выезда новой брони (пересменка), см. disabled ниже.
  const occupied = useMemo(
    () => occupiedNightIndices(busy, cleaningMinutes),
    [busy, cleaningMinutes],
  );

  // Дата заезда текущего незавершённого выбора. Пока задана — календарь в «фазе
  // выезда»: следующий клик по более поздней дате замыкает период. null — «фаза
  // заезда»: следующий клик начинает новый выбор с одной ночи.
  const [anchor, setAnchor] = useState<Date | null>(null);

  const isPast = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  };
  const isBooked = (d: Date) => occupied.has(mskDayIndex(d));

  // Валиден ли день как ДАТА ВЫЕЗДА для текущего заезда: строго позже заезда и
  // период ночей [заезд, выезд) не задевает занятых ночей. Выезд может попасть
  // ровно на первую занятую ночь (пересменка) — она не входит в [заезд, выезд).
  const isValidCheckout = (d: Date) => {
    if (!anchor) return false;
    const aIdx = mskDayIndex(anchor);
    const dIdx = mskDayIndex(d);
    return dIdx > aIdx && !rangeHitsOccupiedNight(aIdx, dIdx, occupied);
  };
  // Валиден ли день как ДАТА ЗАЕЗДА: это свободная ночь.
  const isValidCheckin = (d: Date) => !isBooked(d);

  // День кликабелен, если он годится как выезд для текущего заезда ИЛИ как новый
  // заезд. Так занятая ночь чужой брони доступна как дата выезда (пересменка), но
  // при этом всегда можно начать новый выбор на любой свободной дате.
  const isDisabled = (d: Date) => isPast(d) || !(isValidCheckout(d) || isValidCheckin(d));

  // День внутри выбранного диапазона [from, to] — чтобы зелёная заливка
  // «available» не перебивала фон выделения range_middle/range_end.
  const isInRange = (d: Date) => {
    if (!range?.from) return false;
    const t = d.getTime();
    const from = range.from.getTime();
    const to = (range.to ?? range.from).getTime();
    return t >= from && t <= to;
  };
  const isAvailable = (d: Date) => !isPast(d) && !isBooked(d) && !isInRange(d);

  function addDay(d: Date): Date {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    return next;
  }

  // Ведём выбор сами по кликнутой дате (triggerDate из onSelect), не полагаясь на
  // внутреннюю логику диапазона DayPicker. Сохраняем UX «1 клик = 1 ночь»:
  //  • нет заезда → ставим заезд и показываем 1 ночь;
  //  • клик позже заезда → замыкаем период (выезд = клик);
  //  • клик не позже заезда → перезапуск с новой даты заезда.
  function handleDayClick(clicked: Date) {
    // Продлеваем период, только если клик — валидный выезд для текущего заезда.
    if (anchor && isValidCheckout(clicked)) {
      onChange({ from: anchor, to: clicked });
      setAnchor(null);
      return;
    }
    // Иначе начинаем новый выбор с одной ночи (день заведомо годен как заезд —
    // disabled не пропустил бы сюда занятую ночь).
    setAnchor(clicked);
    onChange({ from: clicked, to: addDay(clicked) });
  }

  return (
    <div>
      <div className="flex justify-center">
        <DayPicker
          mode="range"
          selected={range}
          onSelect={(_range, triggerDate) => handleDayClick(triggerDate)}
          disabled={isDisabled}
          // Отдельные модификаторы, чтобы развести стили: «прошлое» — серым,
          // «занято» — красным. Сами по себе модификаторы клик не блокируют,
          // disabled выше отвечает за это.
          modifiers={{ booked: isBooked, past: isPast, available: isAvailable }}
          modifiersClassNames={{
            booked: "bg-red-100 text-red-700 line-through",
            past: "text-muted-foreground line-through opacity-50",
            available: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
          }}
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
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-50 border border-emerald-200" /> свободно
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100" /> занято
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-200" /> прошло
        </span>
      </div>
    </div>
  );
}

export type DayOccupancy = {
  date: string; // YYYY-MM-DD в МСК
  sectionsUsed: number;
  hasFullVenue: boolean;
};

/**
 * Одиночный пикер для FULL_DAY: клиент выбирает один день целиком.
 * Использует тот же расчёт занятости, что и range-вариант выше.
 *
 * sectionsInfo (опц.) включает секционный режим: вместо «день занят/свободен»
 * проверяется sectionsUsed + needed ≤ total.
 */
export function SingleDayPicker({
  busy,
  cleaningMinutes,
  selected,
  onChange,
  sectionsInfo,
}: {
  busy: BusyInterval[];
  cleaningMinutes: number;
  selected: Date | undefined;
  onChange: (date: Date | undefined) => void;
  sectionsInfo?: {
    total: number;
    needed: number;
    daysOccupancy: DayOccupancy[];
  };
}) {
  const occupied = useMemo(
    () => occupiedNightIndices(busy, cleaningMinutes),
    [busy, cleaningMinutes],
  );

  const occupancyMap = useMemo(() => {
    const m = new Map<string, DayOccupancy>();
    if (sectionsInfo) {
      for (const d of sectionsInfo.daysOccupancy) m.set(d.date, d);
    }
    return m;
  }, [sectionsInfo]);

  const isPast = (d: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
  };
  const isBooked = (d: Date) => {
    if (sectionsInfo) {
      const occ = occupancyMap.get(dateKey(d));
      if (!occ) return false;
      if (occ.hasFullVenue) return true;
      // вся площадка нужна — мешает любая занятая секция
      if (sectionsInfo.needed === sectionsInfo.total && occ.sectionsUsed > 0) return true;
      return occ.sectionsUsed + sectionsInfo.needed > sectionsInfo.total;
    }
    return occupied.has(mskDayIndex(d));
  };
  const isDisabled = (d: Date) => isPast(d) || isBooked(d);
  // Свободный день: не прошёл и не занят — помечаем зелёным.
  const isAvailable = (d: Date) => !isPast(d) && !isBooked(d);

  return (
    <div>
      <div className="flex justify-center">
        <DayPicker
          mode="single"
          selected={selected}
          onSelect={onChange}
          disabled={isDisabled}
          modifiers={{ booked: isBooked, past: isPast, available: isAvailable }}
          modifiersClassNames={{
            booked: "bg-red-100 text-red-700 line-through",
            past: "text-muted-foreground line-through opacity-50",
            available: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
          }}
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
          <span className="inline-block w-3 h-3 rounded-sm bg-emerald-50 border border-emerald-200" /> свободно
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-100" /> занято
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-200" /> прошло
        </span>
      </div>
    </div>
  );
}
