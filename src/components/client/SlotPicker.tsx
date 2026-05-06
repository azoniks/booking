"use client";

import { useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { BusyInterval } from "./AvailabilityCalendar";

const TZ_OFFSET_MIN = 180;
const DAY_MS = 86_400_000;

export type Slot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
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

function addDayISO(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function slotIntervalsForDate(slot: Slot, dateISO: string) {
  const [sh, sm] = slot.startTime.split(":").map(Number);
  const [eh, em] = slot.endTime.split(":").map(Number);
  const crosses = eh * 60 + em <= sh * 60 + sm;
  const startAt = localDateTimeToUtc(dateISO, slot.startTime);
  const endAt = localDateTimeToUtc(crosses ? addDayISO(dateISO) : dateISO, slot.endTime);
  return { startAt, endAt, crosses };
}

function intersects(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
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
    if (!dateISO) return [] as { slot: Slot; busy: boolean; past: boolean; startAt: Date; endAt: Date; crosses: boolean }[];
    return slots.map((slot) => {
      const { startAt, endAt, crosses } = slotIntervalsForDate(slot, dateISO);
      const blockedUntil = new Date(endAt.getTime() + cleaningMinutes * 60_000);
      const past = blockedUntil.getTime() <= Date.now();
      let occupied = false;
      for (const iv of busy) {
        const bs = new Date(iv.startAt);
        const be = new Date(iv.endAt);
        if (intersects(startAt, blockedUntil, bs, be)) {
          occupied = true;
          break;
        }
      }
      return { slot, busy: occupied, past, startAt, endAt, crosses };
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
            return d.getTime() < t.getTime() - DAY_MS;
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
            {slotStates.map(({ slot, busy: occ, past, crosses }) => {
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
                    !past && !occ && !selected && "bg-white hover:bg-slate-50 border-slate-200",
                    !past && !occ && selected && "bg-primary text-primary-foreground border-primary",
                  )}
                >
                  <div className="font-medium">{slot.name}</div>
                  <div className="text-xs">
                    {slot.startTime} — {slot.endTime}
                    {crosses && " (след. день)"}
                  </div>
                  {basePriceLabel && (
                    <div className="text-xs mt-1 opacity-80">{basePriceLabel(slot)}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
