"use client";

import { useEffect, useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityCalendar, SingleDayPicker, type BusyInterval } from "./AvailabilityCalendar";
import { HourlySlotsPicker } from "./HourlySlotsPicker";
import { SlotPicker, type Slot } from "./SlotPicker";

const dateFmt = new Intl.DateTimeFormat("ru-RU", {
  weekday: "short",
  day: "numeric",
  month: "long",
});
const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

function plural(n: number, forms: [string, string, string]) {
  const n10 = Math.abs(n) % 10;
  const n100 = Math.abs(n) % 100;
  if (n100 >= 11 && n100 <= 19) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 >= 2 && n10 <= 4) return forms[1];
  return forms[2];
}

function CalendarHint() {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label="Подсказка по выбору дат"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="h-4 w-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 rounded-md border bg-background p-2 text-xs leading-relaxed text-foreground shadow-md"
        >
          Кликните на день — забронируем одну ночь (выезд утром следующего
          дня). Чтобы выбрать несколько ночей, кликните день заезда, потом
          день выезда.
        </span>
      )}
    </span>
  );
}

type ObjectInfo = {
  id: string;
  name: string;
  bookingMode: "DAILY" | "HOURLY" | "FULL_DAY";
  checkInTime: string | null;
  checkOutTime: string | null;
  hourlyStepMinutes: number;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  minBookingHours: number;
  maxBookingHours: number | null;
  baseCapacity: number;
  maxCapacity: number;
  basePrice: number;
  extraGuestPrice: number;
};

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

export function BookingForm({ object }: { object: ObjectInfo }) {
  const isDaily = object.bookingMode === "DAILY";
  const isFullDay = object.bookingMode === "FULL_DAY";
  const minHours = Math.max(1, object.minBookingHours || 1);

  // DAILY: range — стартуем без выбора, чтобы первый клик задавал «from»
  // с чистого листа. Иначе DayPicker расширял предзаполненный today→tomorrow,
  // и любой клик мимо этих дат тащил диапазон через занятые ночи.
  const [range, setRange] = useState<DateRange | undefined>(undefined);
  // HOURLY (свободные часы): date + indices
  const [hourlyDate, setHourlyDate] = useState<Date | undefined>(todayMSK());
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [endIdx, setEndIdx] = useState<number | null>(null);

  // HOURLY со слотами
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotDate, setSlotDate] = useState<Date | undefined>(todayMSK());
  const [slotId, setSlotId] = useState<string | null>(null);

  // FULL_DAY: одна дата
  const [fullDayDate, setFullDayDate] = useState<Date | undefined>(undefined);

  const [guests, setGuests] = useState(object.baseCapacity);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");

  const [busy, setBusy] = useState<BusyInterval[]>([]);
  const [paymentPercent, setPaymentPercent] = useState(100);
  const [loadingBusy, setLoadingBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загрузка занятости на 90 дней вперёд
  useEffect(() => {
    let aborted = false;
    async function load() {
      setLoadingBusy(true);
      const from = isoDate(todayMSK());
      const toDate = new Date(todayMSK().getTime() + 90 * DAY_MS);
      const to = isoDate(toDate);
      try {
        const res = await fetch(
          `/api/public/object-availability?objectId=${object.id}&from=${from}&to=${to}`,
        );
        const j = await res.json();
        if (!aborted && j.ok) {
          setBusy(j.data.busy);
          setSlots(j.data.slots ?? []);
          setPaymentPercent(Number(j.data.paymentPercent ?? 100));
        }
      } finally {
        if (!aborted) setLoadingBusy(false);
      }
    }
    load();
    return () => {
      aborted = true;
    };
  }, [object.id]);

  const hourlySlots = useMemo(
    () =>
      hourlyDate
        ? buildSlots(
            hourlyDate,
            object.workingHoursStart || "09:00",
            object.workingHoursEnd || "23:00",
            object.hourlyStepMinutes,
          )
        : [],
    [hourlyDate, object.workingHoursStart, object.workingHoursEnd, object.hourlyStepMinutes],
  );

  const useSlots = !isDaily && !isFullDay && slots.length > 0;

  const price = useMemo(() => {
    const extra = Math.max(0, guests - object.baseCapacity);
    if (isFullDay) {
      // FULL_DAY: фиксированная цена за день, без множителя и без доплат за гостей.
      return fullDayDate ? object.basePrice : 0;
    }
    if (isDaily) {
      if (!range?.from || !range?.to) return 0;
      const units = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / DAY_MS));
      return units * object.basePrice + extra * object.extraGuestPrice * units;
    }
    if (useSlots) {
      if (!slotId) return 0;
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return 0;
      const base = slot.priceOverride !== null
        ? slot.priceOverride
        : (() => {
            const [sh, sm] = slot.startTime.split(":").map(Number);
            const [eh, em] = slot.endTime.split(":").map(Number);
            const crosses = eh * 60 + em <= sh * 60 + sm;
            const hours = crosses
              ? 24 - (sh + sm / 60) + (eh + em / 60)
              : (eh + em / 60) - (sh + sm / 60);
            return Math.ceil(hours) * object.basePrice;
          })();
      return base + extra * object.extraGuestPrice;
    }
    if (startIdx === null || endIdx === null) return 0;
    const ms = hourlySlots[endIdx].date.getTime() - hourlySlots[startIdx].date.getTime();
    const units = Math.max(1, Math.ceil(ms / HOUR_MS));
    return units * object.basePrice + extra * object.extraGuestPrice * units;
  }, [
    isDaily,
    isFullDay,
    useSlots,
    range,
    slotId,
    slots,
    startIdx,
    endIdx,
    hourlySlots,
    fullDayDate,
    guests,
    object.baseCapacity,
    object.basePrice,
    object.extraGuestPrice,
  ]);

  const canSubmit = isFullDay
    ? !!fullDayDate
    : isDaily
    ? !!(range?.from && range?.to && range.to > range.from)
    : useSlots
    ? !!(slotDate && slotId)
    : startIdx !== null && endIdx !== null && endIdx > startIdx;

  const summary = useMemo(() => {
    if (isFullDay) {
      if (!fullDayDate) return null;
      return {
        kind: "fullday" as const,
        date: fullDayDate,
        workingHoursStart: object.workingHoursStart || "09:00",
        workingHoursEnd: object.workingHoursEnd || "21:00",
      };
    }
    if (isDaily) {
      if (!range?.from || !range?.to) return null;
      const nights = Math.max(
        1,
        Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS),
      );
      return {
        kind: "daily" as const,
        nights,
        checkIn: range.from,
        checkOut: range.to,
        checkInTime: object.checkInTime || "14:00",
        checkOutTime: object.checkOutTime || "12:00",
      };
    }
    if (useSlots) {
      if (!slotDate || !slotId) return null;
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return null;
      return { kind: "slot" as const, date: slotDate, slot };
    }
    if (startIdx === null || endIdx === null || endIdx <= startIdx) return null;
    const startAt = hourlySlots[startIdx].date;
    const endAt = hourlySlots[endIdx].date;
    const hours = Math.max(
      1,
      Math.round((endAt.getTime() - startAt.getTime()) / HOUR_MS),
    );
    return { kind: "hourly" as const, hours, startAt, endAt };
  }, [
    isDaily,
    isFullDay,
    useSlots,
    range,
    slotDate,
    slotId,
    slots,
    startIdx,
    endIdx,
    hourlySlots,
    fullDayDate,
    object.checkInTime,
    object.checkOutTime,
    object.workingHoursStart,
    object.workingHoursEnd,
  ]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      let body: Record<string, unknown> = {
        objectId: object.id,
        guestsCount: guests,
        guestName: name,
        guestEmail: email,
        guestPhone: phone,
        guestComment: comment,
      };
      if (isFullDay) {
        body = {
          ...body,
          bookingDate: isoDate(fullDayDate!),
        };
      } else if (isDaily) {
        body = {
          ...body,
          checkInDate: isoDate(range!.from!),
          checkOutDate: isoDate(range!.to!),
        };
      } else if (useSlots) {
        body = {
          ...body,
          slotId: slotId!,
          slotDate: isoDate(slotDate!),
        };
      } else {
        body = {
          ...body,
          startAt: hourlySlots[startIdx!].date.toISOString(),
          endAt: hourlySlots[endIdx!].date.toISOString(),
        };
      }
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Ошибка");
        return;
      }
      window.location.href = j.data.confirmationUrl;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Бронирование</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {loadingBusy && (
            <p className="text-xs text-muted-foreground">Загружаем занятость…</p>
          )}

          {isFullDay ? (
            <div>
              <Label className="mb-2 block">Дата</Label>
              <SingleDayPicker
                busy={busy}
                cleaningMinutes={0}
                selected={fullDayDate}
                onChange={setFullDayDate}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Бронь на весь день: {object.workingHoursStart || "09:00"}–
                {object.workingHoursEnd || "21:00"}
              </p>
            </div>
          ) : isDaily ? (
            <div>
              <Label className="mb-2 flex items-center gap-1.5">
                Даты заезда и выезда
                <CalendarHint />
              </Label>
              <AvailabilityCalendar
                busy={busy}
                cleaningMinutes={0}
                range={range}
                onChange={setRange}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Заезд {object.checkInTime}, выезд {object.checkOutTime}
              </p>
            </div>
          ) : useSlots ? (
            <div>
              <Label className="mb-2 block">Дата и слот</Label>
              <SlotPicker
                busy={busy}
                cleaningMinutes={0}
                slots={slots}
                selectedDate={slotDate}
                selectedSlotId={slotId}
                onChangeDate={setSlotDate}
                onChangeSlotId={setSlotId}
                basePriceLabel={(s) =>
                  s.priceOverride !== null
                    ? `${s.priceOverride.toLocaleString("ru-RU")} ₽`
                    : ""
                }
              />
            </div>
          ) : (
            <div>
              <Label className="mb-2 block">Дата и время</Label>
              <HourlySlotsPicker
                busy={busy}
                settings={{
                  workingHoursStart: object.workingHoursStart || "09:00",
                  workingHoursEnd: object.workingHoursEnd || "23:00",
                  hourlyStepMinutes: object.hourlyStepMinutes,
                  minBookingHours: minHours,
                  maxBookingHours: object.maxBookingHours,
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

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="font-semibold mb-1.5">Ваш выбор</div>
            {summary ? (
              summary.kind === "fullday" ? (
                <div className="space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Дата</span>
                    <span className="text-right">{dateFmt.format(summary.date)}</span>
                  </div>
                  <div className="flex justify-between gap-2 border-t pt-1.5 mt-1.5 font-medium">
                    <span>Время</span>
                    <span>
                      {summary.workingHoursStart}–{summary.workingHoursEnd}
                    </span>
                  </div>
                </div>
              ) : summary.kind === "daily" ? (
                <div className="space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Заезд</span>
                    <span className="text-right">
                      {dateFmt.format(summary.checkIn)}, {summary.checkInTime}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Выезд</span>
                    <span className="text-right">
                      {dateFmt.format(summary.checkOut)}, {summary.checkOutTime}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 border-t pt-1.5 mt-1.5 font-medium">
                    <span>Длительность</span>
                    <span>
                      {summary.nights} {plural(summary.nights, ["ночь", "ночи", "ночей"])}
                    </span>
                  </div>
                </div>
              ) : summary.kind === "hourly" ? (
                <div className="space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Начало</span>
                    <span className="text-right">
                      {dateFmt.format(summary.startAt)}, {timeFmt.format(summary.startAt)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Окончание</span>
                    <span className="text-right">
                      {dateFmt.format(summary.endAt)}, {timeFmt.format(summary.endAt)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 border-t pt-1.5 mt-1.5 font-medium">
                    <span>Длительность</span>
                    <span>
                      {summary.hours} {plural(summary.hours, ["час", "часа", "часов"])}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Дата</span>
                    <span className="text-right">{dateFmt.format(summary.date)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Слот</span>
                    <span className="text-right">
                      {summary.slot.name} ({summary.slot.startTime}–{summary.slot.endTime})
                    </span>
                  </div>
                </div>
              )
            ) : (
              <div className="text-xs text-muted-foreground">
                {isFullDay
                  ? "Выберите дату — бронь оформляется на весь день"
                  : isDaily
                  ? "Выберите дату заезда (один клик — одна ночь, два клика — несколько ночей)"
                  : useSlots
                  ? "Выберите дату и слот"
                  : "Выберите дату и интервал времени"}
              </div>
            )}
          </div>

          <div>
            <Label>Гостей</Label>
            <Input
              type="number"
              min={1}
              max={object.maxCapacity}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {isFullDay
                ? `до ${object.maxCapacity} гостей включено`
                : `${object.baseCapacity} включено · доплата за допместо ${object.extraGuestPrice} ₽`}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t">
            <div>
              <Label>ФИО</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <Label>Телефон</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  placeholder="+7…"
                />
              </div>
            </div>
            <div>
              <Label>Комментарий (опционально)</Label>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            </div>
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <div className="border-t pt-4 space-y-2">
            {paymentPercent < 100 && price > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Полная стоимость</span>
                  <span>{price.toLocaleString("ru-RU")} ₽</span>
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Остаток при заселении</span>
                  <span>
                    {Math.round(price * (1 - paymentPercent / 100)).toLocaleString("ru-RU")} ₽
                  </span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      К оплате сейчас (предоплата {paymentPercent}%)
                    </div>
                    <div className="text-2xl font-bold text-gold">
                      {Math.round((price * paymentPercent) / 100).toLocaleString("ru-RU")} ₽
                    </div>
                  </div>
                  <Button type="submit" disabled={submitting || !canSubmit}>
                    {submitting ? "Создание…" : "Забронировать"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">К оплате</div>
                  <div className="text-2xl font-bold text-gold">{price.toLocaleString("ru-RU")} ₽</div>
                </div>
                <Button type="submit" disabled={submitting || !canSubmit}>
                  {submitting ? "Создание…" : "Забронировать и оплатить"}
                </Button>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
