"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { DateRange } from "react-day-picker";
import { type CartSchedule, useCart } from "./CartProvider";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  AvailabilityCalendar,
  SingleDayPicker,
  type BusyInterval,
  type DayOccupancy,
} from "./AvailabilityCalendar";
import { HourlySlotsPicker } from "./HourlySlotsPicker";
import { SlotPicker, type Slot } from "./SlotPicker";
import { slotDurationHours } from "@/lib/slots";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const TZ_OFFSET_MIN = 180;

function isoDate(d: Date): string {
  const local = new Date(d.getTime() + TZ_OFFSET_MIN * 60_000);
  return local.toISOString().slice(0, 10);
}
function todayMSK(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function buildSlots(date: Date, start: string, end: string, step: number) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const out: { time: string; date: Date }[] = [];
  for (let m = startMin; m <= endMin; m += step) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), h, mm);
    out.push({
      time: `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
      date: new Date(local - TZ_OFFSET_MIN * 60_000),
    });
  }
  return out;
}
function sectionsNeededFor(
  guests: number,
  s: { total: number; capacity: number; max: number },
): number {
  const needed = Math.ceil(Math.max(1, guests) / s.capacity);
  if (needed > s.total) return s.total;
  return needed > s.max ? s.total : needed;
}

// "YYYY-MM-DD" → локальная полночь (как представляют даты пикеры).
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
// ISO-инстант → локальная полночь его календарного дня (МSK).
function localDayFromISO(iso: string): Date {
  const u = new Date(new Date(iso).getTime() + TZ_OFFSET_MIN * 60_000);
  return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
}

type Availability = {
  bookingMode: "DAILY" | "HOURLY" | "FULL_DAY";
  cleaningMinutes: number;
  checkInTime: string | null;
  checkOutTime: string | null;
  hourlyStepMinutes: number | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  minBookingHours: number | null;
  maxBookingHours: number | null;
  baseCapacity: number;
  maxCapacity: number;
  basePrice: number;
  extraGuestPrice: number;
  paymentPercent: number;
  paymentType: "PERCENT" | "FIXED";
  paymentAmount: number | null;
  isAddon: boolean;
  parents: { id: string; name: string }[];
  sections: { total: number; capacity: number; max: number; fullVenuePrice: number | null } | null;
  daysOccupancy: DayOccupancy[];
  slots: Slot[];
  busy: BusyInterval[];
};

export type ScheduleState = {
  objectId: string;
  valid: boolean;
  price: number;
  prepayment: number;
  guestsCount: number;
  // фрагмент payload для booking-groups (без гостевых данных)
  payload: Record<string, unknown> | null;
};

export function ObjectSchedulePicker({
  objectId,
  objectName,
  initial,
  onChange,
  onRemove,
  suppressParentNotice = false,
}: {
  objectId: string;
  objectName: string;
  initial?: CartSchedule;
  onChange: (s: ScheduleState) => void;
  onRemove: () => void;
  // В админке корзины нет — подсказку про родителя-в-корзине не показываем.
  suppressParentNotice?: boolean;
}) {
  const { has } = useCart();
  const [av, setAv] = useState<Availability | null>(null);
  const [loading, setLoading] = useState(true);

  const [guestsInput, setGuestsInput] = useState("1");
  const guests = guestsInput === "" ? 0 : Number(guestsInput);

  const [range, setRange] = useState<DateRange | undefined>(undefined);
  const [hourlyDate, setHourlyDate] = useState<Date | undefined>(todayMSK());
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [endIdx, setEndIdx] = useState<number | null>(null);
  const [slotDate, setSlotDate] = useState<Date | undefined>(todayMSK());
  const [slotId, setSlotId] = useState<string | null>(null);
  const [fullDayDate, setFullDayDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    const from = isoDate(todayMSK());
    const to = isoDate(new Date(todayMSK().getTime() + 90 * DAY_MS));
    fetch(`/api/public/object-availability?objectId=${objectId}&from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((j) => {
        if (aborted || !j.ok) return;
        setAv(j.data);
        setGuestsInput(String(j.data.baseCapacity ?? 1));
      })
      .finally(() => !aborted && setLoading(false));
    return () => {
      aborted = true;
    };
  }, [objectId]);

  // Подстановка ранее выбранного в карточке расписания (один раз, после загрузки).
  const prefilled = useRef(false);
  useEffect(() => {
    if (!av || prefilled.current) return;
    prefilled.current = true;
    if (!initial) return;
    if (initial.guestsCount) setGuestsInput(String(initial.guestsCount));
    if (initial.checkInDate && initial.checkOutDate) {
      setRange({
        from: parseLocalDate(initial.checkInDate),
        to: parseLocalDate(initial.checkOutDate),
      });
    }
    if (initial.bookingDate) setFullDayDate(parseLocalDate(initial.bookingDate));
    if (initial.slotDate) setSlotDate(parseLocalDate(initial.slotDate));
    if (initial.slotId) setSlotId(initial.slotId);
    if (initial.startAt) setHourlyDate(localDayFromISO(initial.startAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [av]);

  // Восстановление индексов почасового интервала после построения hourlySlots.
  const hourlyPrefilled = useRef(false);

  const isDaily = av?.bookingMode === "DAILY";
  const isFullDay = av?.bookingMode === "FULL_DAY";
  const slots = useMemo(() => av?.slots ?? [], [av]);
  const useSlots = !!av && !isDaily && !isFullDay && slots.length > 0;
  const isSectional = !!isFullDay && !!av?.sections;
  const sectionsNeeded = useMemo(
    () => (isSectional && av?.sections ? sectionsNeededFor(guests, av.sections) : 0),
    [isSectional, guests, av?.sections],
  );

  const hourlySlots = useMemo(
    () =>
      av && hourlyDate
        ? buildSlots(
            hourlyDate,
            av.workingHoursStart || "09:00",
            av.workingHoursEnd || "23:00",
            av.hourlyStepMinutes || 60,
          )
        : [],
    [av, hourlyDate],
  );

  useEffect(() => {
    if (hourlyPrefilled.current) return;
    if (!initial?.startAt || !initial?.endAt || hourlySlots.length === 0) return;
    const s = hourlySlots.findIndex((x) => x.date.getTime() === new Date(initial.startAt!).getTime());
    const e = hourlySlots.findIndex((x) => x.date.getTime() === new Date(initial.endAt!).getTime());
    if (s >= 0 && e >= 0) {
      setStartIdx(s);
      setEndIdx(e);
      hourlyPrefilled.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourlySlots]);

  const price = useMemo(() => {
    if (!av) return 0;
    const extra = Math.max(0, guests - av.baseCapacity);
    if (isSectional && av.sections) {
      if (!fullDayDate) return 0;
      const isFull = sectionsNeeded === av.sections.total;
      if (isFull && av.sections.fullVenuePrice) return av.sections.fullVenuePrice;
      return av.basePrice * sectionsNeeded;
    }
    if (isFullDay) return fullDayDate ? av.basePrice : 0;
    if (isDaily) {
      if (!range?.from || !range?.to) return 0;
      const units = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / DAY_MS));
      return units * av.basePrice + extra * av.extraGuestPrice * units;
    }
    if (useSlots) {
      if (!slotId) return 0;
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return 0;
      const base =
        slot.priceOverride !== null
          ? slot.priceOverride
          : Math.ceil(slotDurationHours(slot)) * av.basePrice;
      return base + extra * av.extraGuestPrice;
    }
    if (startIdx === null || endIdx === null) return 0;
    const ms = hourlySlots[endIdx].date.getTime() - hourlySlots[startIdx].date.getTime();
    const units = Math.max(1, Math.ceil(ms / HOUR_MS));
    return units * av.basePrice + extra * av.extraGuestPrice * units;
  }, [av, guests, isSectional, isFullDay, isDaily, useSlots, sectionsNeeded, range, slotId, slots, startIdx, endIdx, hourlySlots, fullDayDate]);

  const prepayment = useMemo(() => {
    if (!av || price <= 0) return 0;
    if (av.paymentType === "FIXED" && av.paymentAmount != null) {
      return Math.min(av.paymentAmount, price);
    }
    return Math.round((price * av.paymentPercent) / 100 * 100) / 100;
  }, [av, price]);

  const guestsValid = !!av && guests >= 1 && (isSectional || guests <= av.maxCapacity);

  const scheduleValid = isFullDay
    ? !!fullDayDate
    : isDaily
      ? !!(range?.from && range?.to && range.to > range.from)
      : useSlots
        ? !!(slotDate && slotId)
        : startIdx !== null && endIdx !== null && endIdx > startIdx;

  const valid = !!av && guestsValid && scheduleValid && price > 0;

  const payload = useMemo<Record<string, unknown> | null>(() => {
    if (!av || !scheduleValid) return null;
    const base: Record<string, unknown> = { objectId, guestsCount: guests };
    if (isFullDay) return { ...base, bookingDate: isoDate(fullDayDate!) };
    if (isDaily)
      return { ...base, checkInDate: isoDate(range!.from!), checkOutDate: isoDate(range!.to!) };
    if (useSlots) return { ...base, slotId: slotId!, slotDate: isoDate(slotDate!) };
    return {
      ...base,
      startAt: hourlySlots[startIdx!].date.toISOString(),
      endAt: hourlySlots[endIdx!].date.toISOString(),
    };
  }, [av, scheduleValid, objectId, guests, isFullDay, isDaily, useSlots, fullDayDate, range, slotId, slotDate, hourlySlots, startIdx, endIdx]);

  // Репорт наверх при изменениях.
  useEffect(() => {
    onChange({ objectId, valid, price, prepayment, guestsCount: guests, payload });
    // onChange намеренно не в зависимостях — родитель передаёт стабильный колбэк
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectId, valid, price, prepayment, guests, payload]);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{objectName}</div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-muted-foreground">
          <X className="w-4 h-4 mr-1" /> Убрать
        </Button>
      </div>

      {/* Аддон без родителя в корзине — подсказываем, с чем его можно забронировать */}
      {!suppressParentNotice && av?.isAddon && av.parents.length > 0 && !av.parents.some((p) => has(p.id)) && (
        <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm">
          <div className="text-amber-800">
            Этот объект бронируется только вместе с основным. Добавьте один из объектов:
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {av.parents.map((p) => (
              <Link
                key={p.id}
                href={`/booking/${p.id}`}
                className="inline-flex items-center px-2.5 py-1 rounded-md border bg-white hover:bg-slate-50 text-xs"
              >
                {p.name} →
              </Link>
            ))}
          </div>
        </div>
      )}

      {loading || !av ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <>
          {isFullDay ? (
            <div>
              <Label className="mb-2 block">Дата</Label>
              <SingleDayPicker
                busy={av.busy}
                cleaningMinutes={0}
                selected={fullDayDate}
                onChange={setFullDayDate}
                sectionsInfo={
                  isSectional && av.sections
                    ? { total: av.sections.total, needed: sectionsNeeded, daysOccupancy: av.daysOccupancy }
                    : undefined
                }
              />
            </div>
          ) : isDaily ? (
            <div>
              <Label className="mb-2 block">Даты заезда и выезда</Label>
              <AvailabilityCalendar busy={av.busy} cleaningMinutes={0} range={range} onChange={setRange} />
            </div>
          ) : useSlots ? (
            <div>
              <Label className="mb-2 block">Дата и слот</Label>
              <SlotPicker
                busy={av.busy}
                cleaningMinutes={0}
                slots={slots}
                selectedDate={slotDate}
                selectedSlotId={slotId}
                onChangeDate={setSlotDate}
                onChangeSlotId={setSlotId}
                basePriceLabel={(s) =>
                  s.priceOverride !== null ? `${s.priceOverride.toLocaleString("ru-RU")} ₽` : ""
                }
              />
            </div>
          ) : (
            <div>
              <Label className="mb-2 block">Дата и время</Label>
              <HourlySlotsPicker
                busy={av.busy}
                settings={{
                  workingHoursStart: av.workingHoursStart || "09:00",
                  workingHoursEnd: av.workingHoursEnd || "23:00",
                  hourlyStepMinutes: av.hourlyStepMinutes || 60,
                  minBookingHours: Math.max(1, av.minBookingHours || 1),
                  maxBookingHours: av.maxBookingHours,
                }}
                selectedDate={hourlyDate}
                startSlot={startIdx}
                endSlot={endIdx}
                onChangeDate={setHourlyDate}
                onChangeRange={(s, e) => {
                  setStartIdx(s);
                  setEndIdx(e);
                }}
              />
            </div>
          )}

          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <Label className="text-xs">Гостей</Label>
              <Input
                type="number"
                min={1}
                value={guestsInput}
                onChange={(e) => setGuestsInput(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="ml-auto text-right text-sm">
              {price > 0 ? (
                <>
                  <div className="font-semibold">{price.toLocaleString("ru-RU")} ₽</div>
                  {prepayment > 0 && prepayment < price && (
                    <div className="text-xs text-muted-foreground">
                      предоплата {prepayment.toLocaleString("ru-RU")} ₽
                    </div>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">выберите дату/время</span>
              )}
            </div>
          </div>
          {av && !guestsValid && guests > av.maxCapacity && (
            <p className="text-xs text-destructive">Максимум гостей: {av.maxCapacity}</p>
          )}
        </>
      )}
    </div>
  );
}
