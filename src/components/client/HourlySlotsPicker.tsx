"use client";

import { useEffect, useMemo, useState } from "react";
import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BusyInterval } from "./AvailabilityCalendar";

export interface HourlySettings {
  workingHoursStart: string; // "09:00"
  workingHoursEnd: string;   // "23:00"
  hourlyStepMinutes: number; // 60
  minBookingHours: number;
  maxBookingHours: number | null;
}

const TZ_OFFSET_MIN = 180; // Europe/Moscow

function makeLocalDate(date: Date, hh: number, mm: number): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  const local = Date.UTC(y, m, d, hh, mm) - TZ_OFFSET_MIN * 60_000;
  return new Date(local);
}

function buildSlots(date: Date | undefined, s: HourlySettings) {
  if (!date) return [] as { time: string; date: Date }[];
  const [sh, sm] = s.workingHoursStart.split(":").map(Number);
  const [eh, em] = s.workingHoursEnd.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const out: { time: string; date: Date }[] = [];
  for (let m = startMin; m <= endMin; m += s.hourlyStepMinutes) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push({
      time: `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      date: makeLocalDate(date, h, mm),
    });
  }
  return out;
}

function isSlotBusy(slotStart: Date, slotEnd: Date, busy: BusyInterval[]): boolean {
  for (const iv of busy) {
    const s = new Date(iv.startAt).getTime();
    const e = new Date(iv.endAt).getTime();
    if (slotStart.getTime() < e && s < slotEnd.getTime()) return true;
  }
  return false;
}

type EndState =
  | "valid_end"     // можно выбрать как окончание
  | "too_short"     // < min hours от старта
  | "too_long"      // > max hours от старта
  | "blocked_busy"  // между стартом и этим слотом есть занятый
  | "before_start"; // левее старта

export function HourlySlotsPicker({
  busy,
  settings,
  selectedDate,
  startSlot,
  endSlot,
  onChangeDate,
  onChangeRange,
}: {
  busy: BusyInterval[];
  settings: HourlySettings;
  selectedDate: Date | undefined;
  startSlot: number | null;
  endSlot: number | null;
  onChangeDate: (d: Date | undefined) => void;
  onChangeRange: (start: number | null, end: number | null) => void;
}) {
  const slots = useMemo(() => buildSlots(selectedDate, settings), [selectedDate, settings]);

  const busyFlags = useMemo(() => {
    return slots.map((s, i) => {
      if (i === slots.length - 1) return false;
      const next = slots[i + 1].date;
      return isSlotBusy(s.date, next, busy);
    });
  }, [slots, busy]);

  const [hint, setHint] = useState<{ kind: "info" | "warn"; text: string } | null>(null);

  // Сбрасываем hint когда меняется выбор
  useEffect(() => {
    setHint(null);
  }, [startSlot, endSlot, selectedDate]);

  function endStateFor(i: number): EndState {
    if (startSlot === null) return "valid_end";
    if (i <= startSlot) return "before_start";
    for (let k = startSlot; k < i; k++) {
      if (busyFlags[k]) return "blocked_busy";
    }
    const hours =
      (slots[i].date.getTime() - slots[startSlot].date.getTime()) / 3_600_000;
    if (hours < settings.minBookingHours) return "too_short";
    if (settings.maxBookingHours && hours > settings.maxBookingHours) return "too_long";
    return "valid_end";
  }

  function handleClick(i: number) {
    const isLast = i === slots.length - 1;

    // Старта ещё нет — пробуем поставить
    if (startSlot === null || endSlot !== null) {
      if (isLast) {
        setHint({
          kind: "warn",
          text: "Этот слот можно выбрать только как окончание. Сначала выберите начало раньше.",
        });
        return;
      }
      if (busyFlags[i]) {
        setHint({ kind: "warn", text: "Этот слот занят. Выберите свободный для начала." });
        return;
      }
      onChangeRange(i, null);
      return;
    }

    // Старт есть, ставим конец
    if (i === startSlot) {
      // снять выбор
      onChangeRange(null, null);
      return;
    }

    if (i < startSlot) {
      // клик левее — переинтерпретируем как новый старт
      if (busyFlags[i]) {
        setHint({ kind: "warn", text: "Этот слот занят." });
        return;
      }
      onChangeRange(i, null);
      return;
    }

    // i > startSlot
    const state = endStateFor(i);
    if (state === "valid_end") {
      onChangeRange(startSlot, i);
      return;
    }
    if (state === "blocked_busy") {
      setHint({
        kind: "warn",
        text: "Между началом и этим слотом есть занятое время. Выберите окончание раньше или измените начало.",
      });
      return;
    }
    if (state === "too_short") {
      const minEnd = slots[startSlot + settings.minBookingHours]?.time;
      setHint({
        kind: "warn",
        text: `Минимальная длительность ${settings.minBookingHours} ч.${minEnd ? ` Самое раннее окончание — ${minEnd}.` : ""}`,
      });
      return;
    }
    if (state === "too_long" && settings.maxBookingHours) {
      const maxEnd = slots[startSlot + settings.maxBookingHours]?.time;
      setHint({
        kind: "warn",
        text: `Максимальная длительность ${settings.maxBookingHours} ч.${maxEnd ? ` Самое позднее окончание — ${maxEnd}.` : ""}`,
      });
      return;
    }
  }

  // Подсказка под сеткой при выборе старта
  const guideText = (() => {
    if (startSlot === null) return null;
    if (endSlot !== null) return null;
    const minIdx = startSlot + settings.minBookingHours;
    const maxIdx = settings.maxBookingHours
      ? Math.min(slots.length - 1, startSlot + settings.maxBookingHours)
      : slots.length - 1;
    const minEnd = slots[minIdx]?.time;
    const maxEnd = slots[maxIdx]?.time;
    if (!minEnd) {
      return "Выбранный старт не позволяет уложиться в минимальную длительность — слотов до конца рабочего времени не хватает.";
    }
    if (settings.maxBookingHours) {
      return `Выбран старт ${slots[startSlot].time}. Кликните окончание между ${minEnd} и ${maxEnd}.`;
    }
    return `Выбран старт ${slots[startSlot].time}. Кликните окончание не раньше ${minEnd}.`;
  })();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            onChangeDate(d);
            onChangeRange(null, null);
          }}
          disabled={(d) => {
            const t = new Date();
            t.setHours(0, 0, 0, 0);
            return d < t;
          }}
          locale={ru}
          weekStartsOn={1}
          showOutsideDays={false}
        />
      </div>
      <div>
        {!selectedDate && (
          <p className="text-sm text-muted-foreground">Выберите дату</p>
        )}
        {selectedDate && (
          <>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {slots.map((s, i) => {
                const isLast = i === slots.length - 1;
                const isBusy = !isLast && busyFlags[i];
                const isStart = startSlot === i;
                const isEnd = endSlot === i;
                const inRange =
                  startSlot !== null &&
                  endSlot !== null &&
                  i >= startSlot &&
                  i <= endSlot;
                const past = s.date.getTime() < Date.now();

                // если выбран только start и end — этот слот в зоне допустимых end?
                const candidateState: EndState =
                  startSlot !== null && endSlot === null && !past && !isBusy
                    ? endStateFor(i)
                    : "valid_end";
                const isCandidate =
                  startSlot !== null &&
                  endSlot === null &&
                  !past &&
                  !isBusy &&
                  i > startSlot &&
                  candidateState === "valid_end";
                const isOutOfRange =
                  startSlot !== null &&
                  endSlot === null &&
                  !past &&
                  !isBusy &&
                  i > startSlot &&
                  (candidateState === "too_short" || candidateState === "too_long");

                let title: string | undefined;
                if (isBusy) title = "Занято";
                else if (past) title = "Время уже прошло";
                else if (candidateState === "too_short")
                  title = `Меньше минимума (${settings.minBookingHours} ч)`;
                else if (candidateState === "too_long" && settings.maxBookingHours)
                  title = `Больше максимума (${settings.maxBookingHours} ч)`;
                else if (candidateState === "blocked_busy")
                  title = "Перекрывает занятый слот";

                return (
                  <button
                    key={s.time}
                    type="button"
                    disabled={isBusy || past}
                    onClick={() => handleClick(i)}
                    title={title}
                    className={cn(
                      "px-2 py-2 rounded-md text-sm border transition-colors",
                      past && "bg-slate-100 text-muted-foreground line-through",
                      !past &&
                        isBusy &&
                        "bg-rose-50 text-rose-400 border-rose-200 line-through cursor-not-allowed",
                      !past && !isBusy && !inRange && "bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700",
                      !past && inRange && "bg-primary text-primary-foreground border-primary",
                      // выделение валидных кандидатов на end
                      !past && !isBusy && isCandidate && !inRange &&
                        "bg-emerald-100 border-emerald-400 text-emerald-800 font-medium",
                      // out-of-range — приглушено
                      !past && isOutOfRange &&
                        "opacity-50 bg-white hover:bg-white border-dashed",
                      (isStart || isEnd) && "ring-2 ring-primary",
                    )}
                  >
                    {s.time}
                  </button>
                );
              })}
            </div>

            {/* Hint после неудачного клика */}
            {hint && (
              <div
                className={cn(
                  "mt-3 flex items-start gap-2 text-sm rounded-md p-2.5 border",
                  hint.kind === "warn"
                    ? "bg-amber-50 border-amber-200 text-amber-800"
                    : "bg-slate-50 border-slate-200 text-muted-foreground",
                )}
              >
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{hint.text}</span>
              </div>
            )}

            {/* Контекстная подсказка при выбранном старте */}
            {guideText && !hint && (
              <div className="mt-3 flex items-start gap-2 text-sm rounded-md p-2.5 border bg-emerald-50/60 border-emerald-200 text-emerald-800">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{guideText}</span>
              </div>
            )}

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-emerald-50 border border-emerald-200" />
                свободно
              </span>
              {startSlot !== null && endSlot === null && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-3 h-3 rounded-sm bg-emerald-100 border border-emerald-400" />
                  допустимое окончание
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-rose-50 border border-rose-200" />
                занято
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-sm bg-primary" />
                выбрано
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {startSlot === null
                ? `Кликните начало. Минимум ${settings.minBookingHours} ч${settings.maxBookingHours ? `, максимум ${settings.maxBookingHours} ч` : ""}.`
                : "Кликните на «начало» ещё раз чтобы снять выбор."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
