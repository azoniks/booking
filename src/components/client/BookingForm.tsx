"use client";

import { useEffect, useState, useMemo } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AvailabilityCalendar, type BusyInterval } from "./AvailabilityCalendar";
import { HourlySlotsPicker } from "./HourlySlotsPicker";
import { SlotPicker, type Slot } from "./SlotPicker";

type ObjectInfo = {
  id: string;
  name: string;
  bookingMode: "DAILY" | "HOURLY";
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

function tomorrowMSK(): Date {
  const t = todayMSK();
  t.setDate(t.getDate() + 1);
  return t;
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
  const minHours = Math.max(1, object.minBookingHours || 1);

  // DAILY: range
  const [range, setRange] = useState<DateRange | undefined>({
    from: todayMSK(),
    to: tomorrowMSK(),
  });
  // HOURLY (свободные часы): date + indices
  const [hourlyDate, setHourlyDate] = useState<Date | undefined>(todayMSK());
  const [startIdx, setStartIdx] = useState<number | null>(null);
  const [endIdx, setEndIdx] = useState<number | null>(null);

  // HOURLY со слотами
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotDate, setSlotDate] = useState<Date | undefined>(todayMSK());
  const [slotId, setSlotId] = useState<string | null>(null);

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

  const useSlots = !isDaily && slots.length > 0;

  const price = useMemo(() => {
    const extra = Math.max(0, guests - object.baseCapacity);
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
    useSlots,
    range,
    slotId,
    slots,
    startIdx,
    endIdx,
    hourlySlots,
    guests,
    object.baseCapacity,
    object.basePrice,
    object.extraGuestPrice,
  ]);

  const canSubmit = isDaily
    ? !!(range?.from && range?.to && range.to > range.from)
    : useSlots
    ? !!(slotDate && slotId)
    : startIdx !== null && endIdx !== null && endIdx > startIdx;

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
      if (isDaily) {
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

          {isDaily ? (
            <div>
              <Label className="mb-2 block">Даты заезда и выезда</Label>
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
              {object.baseCapacity} включено · доплата за допместо {object.extraGuestPrice} ₽
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
