"use client";

import { useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { addDaysISO, formatSlotEndSuffix } from "@/lib/slots";
import type { BusyInterval } from "./AvailabilityCalendar";

const TZ_OFFSET_MIN = 180;
const DAY_MS = 86_400_000;

export type Slot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  endDayOffset: number;
  priceOverride: number | null;
};

function localDateTimeToUtc(dateISO: string, timeHHMM: string): Date {
  const [h, m] = timeHHMM.split(":").map(Number);
  const [Y, M, D] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(Y, M - 1, D, h, m) - TZ_OFFSET_MIN * 60_000);
}

function isoDate(d: Date): string {
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  return local.toISOString().slice(0, 10);
}

function slotIntervalsForDate(slot: Slot, dateISO: string) {
  const startAt = localDateTimeToUtc(dateISO, slot.startTime);
  const endAt = localDateTimeToUtc(
    addDaysISO(dateISO, slot.endDayOffset),
    slot.endTime,
  );
  return { startAt, endAt };
}

function intersects(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

// Состояние одного слота на конкретную дату: занят (пересекается с бронью/блоком
// с учётом уборки) или прошёл.
function slotStateFor(
  slot: Slot,
  dateISO: string,
  busy: BusyInterval[],
  cleaningMinutes: number,
): { busy: boolean; past: boolean; startAt: Date; endAt: Date } {
  const { startAt, endAt } = slotIntervalsForDate(slot, dateISO);
  const blockedUntil = new Date(endAt.getTime() + cleaningMinutes * 60_000);
  const past = blockedUntil.getTime() <= Date.now();
  let occupied = false;
  for (const iv of busy) {
    if (intersects(startAt, blockedUntil, new Date(iv.startAt), new Date(iv.endAt))) {
      occupied = true;
      break;
    }
  }
  return { busy: occupied, past, startAt, endAt };
}

// День недоступен (красный), если все слоты этого дня заняты или прошли.
function dayUnavailable(
  date: Date,
  slots: Slot[],
  busy: BusyInterval[],
  cleaningMinutes: number,
): boolean {
  if (slots.length === 0) return true;
  const dISO = isoDate(date);
  return slots.every((slot) => {
    const st = slotStateFor(slot, dISO, busy, cleaningMinutes);
    return st.busy || st.past;
  });
}

export function SlotPicker({
  busy,
  cleaningMinutes,
  slots,
  selectedDate,
  selectedSlotId,
  onChangeDate,
  onChangeSlotId,
  basePriceLabel,
}: {
  busy: BusyInterval[];
  cleaningMinutes: number;
  slots: Slot[];
  selectedDate: Date | undefined;
  selectedSlotId: string | null;
  onChangeDate: (d: Date | undefined) => void;
  onChangeSlotId: (id: string | null) => void;
  basePriceLabel?: (slot: Slot) => string;
}) {
  // Кандидатные интервалы каждого слота для выбранной даты с учётом уборки
  const dateISO = selectedDate ? isoDate(selectedDate) : null;
  const slotStates = useMemo(() => {
    if (!dateISO) return [] as { slot: Slot; busy: boolean; past: boolean; startAt: Date; endAt: Date }[];
    return slots.map((slot) => {
      const st = slotStateFor(slot, dateISO, busy, cleaningMinutes);
      return { slot, busy: st.busy, past: st.past, startAt: st.startAt, endAt: st.endAt };
    });
  }, [slots, dateISO, busy, cleaningMinutes]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <DayPicker
          mode="single"
          selected={selectedDate}
          onSelect={(d) => {
            onChangeDate(d);
            onChangeSlotId(null);
          }}
          disabled={(d) => {
            const t = new Date();
            t.setHours(0, 0, 0, 0);
            if (d.getTime() < t.getTime() - DAY_MS) return true;
            return dayUnavailable(d, slots, busy, cleaningMinutes);
          }}
          // Будущие дни со свободными слотами подсвечиваем зелёным; дни, где все
          // слоты заняты/прошли — красным. Занятость конкретных слотов внутри дня
          // показываем ниже на карточках.
          modifiers={{
            booked: (d) => {
              const t = new Date();
              t.setHours(0, 0, 0, 0);
              return d.getTime() >= t.getTime() - DAY_MS && dayUnavailable(d, slots, busy, cleaningMinutes);
            },
            available: (d) => {
              const t = new Date();
              t.setHours(0, 0, 0, 0);
              return (
                d.getTime() >= t.getTime() - DAY_MS &&
                !dayUnavailable(d, slots, busy, cleaningMinutes)
              );
            },
          }}
          modifiersClassNames={{
            booked: "bg-red-100 text-red-700 line-through",
            available: "text-emerald-700 hover:bg-emerald-50",
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
        {selectedDate && slots.length === 0 && (
          <p className="text-sm text-muted-foreground">Слоты не настроены</p>
        )}
        {selectedDate && slots.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {slotStates.map(({ slot, busy: occ, past }) => {
              const disabled = occ || past;
              const selected = slot.id === selectedSlotId;
              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onChangeSlotId(selected ? null : slot.id)}
                  className={cn(
                    "text-left p-3 rounded-md border transition-colors",
                    past && "bg-slate-100 text-muted-foreground cursor-not-allowed",
                    !past && occ && "bg-rose-50 text-rose-500 border-rose-200 line-through cursor-not-allowed",
                    !past && !occ && !selected && "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200",
                    !past && !occ && selected && "bg-primary text-primary-foreground border-primary",
                  )}
                >
                  <div className="font-medium">{slot.name}</div>
                  <div className="text-xs">
                    {slot.startTime} — {slot.endTime}
                    {formatSlotEndSuffix(slot.endDayOffset)}
                  </div>
                  {basePriceLabel && (
                    <div className="text-xs mt-1 opacity-80">{basePriceLabel(slot)}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {selectedDate && slots.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-emerald-50 border border-emerald-200" /> свободно
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-rose-50 border border-rose-200" /> занято
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-primary" /> выбрано
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
