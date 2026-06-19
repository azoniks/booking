"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/use-toast";
import { formatSlotEndSuffix } from "@/lib/slots";

type Slot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  endDayOffset: number;
};

type Props = {
  id: string;
  initial: {
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guestComment: string | null;
    guestsCount: number;
  };
  maxCapacity: number;
  bookingMode: "DAILY" | "HOURLY" | "FULL_DAY";
  checkInTime: string | null;
  checkOutTime: string | null;
  slots: Slot[];
  // Префилл полей расписания (локальные строки): даты YYYY-MM-DD, для HOURLY —
  // startAt/endAt в формате datetime-local (YYYY-MM-DDTHH:mm).
  initialSchedule: {
    checkInDate?: string;
    checkOutDate?: string;
    bookingDate?: string;
    slotDate?: string;
    startAt?: string;
    endAt?: string;
  };
};

export function AdminBookingEditForm({
  id,
  initial,
  maxCapacity,
  bookingMode,
  checkInTime,
  checkOutTime,
  slots,
  initialSchedule,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Для HOURLY: бронь не хранит slotId, поэтому по умолчанию — произвольный
  // интервал с префиллом из startAt/endAt. Слот можно выбрать вручную.
  const [hourlyMode, setHourlyMode] = useState<"slot" | "custom">("custom");
  const [slotId, setSlotId] = useState("");

  // Открываем нативный календарь по клику в любом месте поля.
  const openPicker = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
    try {
      el.showPicker?.();
    } catch {
      // вне user-gesture / не поддерживается — игнорируем
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const guestsCount = Number(fd.get("guestsCount") || 1);

    // Расписание по режиму объекта.
    const schedule: Record<string, unknown> = { guestsCount };
    if (bookingMode === "DAILY") {
      schedule.checkInDate = String(fd.get("checkInDate") || "");
      schedule.checkOutDate = String(fd.get("checkOutDate") || "");
    } else if (bookingMode === "FULL_DAY") {
      schedule.bookingDate = String(fd.get("bookingDate") || "");
    } else if (hourlyMode === "slot") {
      if (!slotId) {
        toast({ title: "Выберите слот", variant: "destructive" });
        return;
      }
      schedule.slotId = slotId;
      schedule.slotDate = String(fd.get("slotDate") || "");
    } else {
      const startLocal = String(fd.get("startAt") || "");
      const endLocal = String(fd.get("endAt") || "");
      if (!startLocal || !endLocal) {
        toast({ title: "Укажите начало и конец", variant: "destructive" });
        return;
      }
      schedule.startAt = new Date(startLocal).toISOString();
      schedule.endAt = new Date(endLocal).toISOString();
    }

    const body = {
      guestName: String(fd.get("guestName") || "").trim(),
      guestEmail: String(fd.get("guestEmail") || "").trim(),
      guestPhone: String(fd.get("guestPhone") || "").trim(),
      guestComment: String(fd.get("guestComment") || "").trim(),
      schedule,
    };

    setSubmitting(true);
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setSubmitting(false);
    if (!j.ok) {
      toast({
        title: "Ошибка",
        description: j.error || "Не удалось сохранить",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Бронь обновлена" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Редактировать">
          <Pencil className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Редактировать</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Редактирование брони</SheetTitle>
          <SheetDescription>
            Данные гостя и дата/время. Объект не меняется; цена пересчитывается по новым датам.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col min-h-0">
          <SheetBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Дата и время */}
              {bookingMode === "DAILY" && (
                <>
                  <div>
                    <Label>Заезд</Label>
                    <Input
                      name="checkInDate"
                      type="date"
                      required
                      defaultValue={initialSchedule.checkInDate}
                      onClick={openPicker}
                    />
                    {checkInTime && (
                      <p className="text-xs text-muted-foreground mt-1">
                        время заезда: {checkInTime}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Выезд</Label>
                    <Input
                      name="checkOutDate"
                      type="date"
                      required
                      defaultValue={initialSchedule.checkOutDate}
                      onClick={openPicker}
                    />
                    {checkOutTime && (
                      <p className="text-xs text-muted-foreground mt-1">
                        время выезда: {checkOutTime}
                      </p>
                    )}
                  </div>
                </>
              )}

              {bookingMode === "FULL_DAY" && (
                <div className="md:col-span-2">
                  <Label>Дата</Label>
                  <Input
                    name="bookingDate"
                    type="date"
                    required
                    defaultValue={initialSchedule.bookingDate}
                    onClick={openPicker}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    бронь на весь рабочий день
                  </p>
                </div>
              )}

              {bookingMode === "HOURLY" && (
                <>
                  <div className="md:col-span-2 flex gap-2 items-center flex-wrap">
                    <Label className="!mb-0">Режим:</Label>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={hourlyMode === "slot" ? "default" : "outline"}
                        onClick={() => setHourlyMode("slot")}
                        disabled={slots.length === 0}
                      >
                        Слот
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={hourlyMode === "custom" ? "default" : "outline"}
                        onClick={() => setHourlyMode("custom")}
                      >
                        Произвольно
                      </Button>
                    </div>
                    {slots.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        у типа нет слотов — только произвольный интервал
                      </span>
                    )}
                  </div>

                  {hourlyMode === "slot" && slots.length > 0 ? (
                    <>
                      <div>
                        <Label>Слот</Label>
                        <select
                          value={slotId}
                          onChange={(e) => setSlotId(e.target.value)}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                          required
                        >
                          <option value="">— выберите —</option>
                          {slots.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.startTime}–{s.endTime}
                              {formatSlotEndSuffix(s.endDayOffset)})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Дата</Label>
                        <Input
                          name="slotDate"
                          type="date"
                          required
                          defaultValue={initialSchedule.slotDate}
                          onClick={openPicker}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label>Начало</Label>
                        <Input
                          name="startAt"
                          type="datetime-local"
                          required
                          defaultValue={initialSchedule.startAt}
                          onClick={openPicker}
                        />
                      </div>
                      <div>
                        <Label>Конец</Label>
                        <Input
                          name="endAt"
                          type="datetime-local"
                          required
                          defaultValue={initialSchedule.endAt}
                          onClick={openPicker}
                        />
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Данные гостя */}
              <div>
                <Label>Имя гостя</Label>
                <Input
                  name="guestName"
                  defaultValue={initial.guestName}
                  required
                  minLength={2}
                />
              </div>
              <div>
                <Label>Гостей</Label>
                <Input
                  name="guestsCount"
                  type="number"
                  min={1}
                  max={maxCapacity}
                  defaultValue={initial.guestsCount}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  максимум {maxCapacity}
                </p>
              </div>
              <div>
                <Label>Телефон</Label>
                <Input
                  name="guestPhone"
                  defaultValue={initial.guestPhone}
                  required
                  placeholder="+7..."
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  name="guestEmail"
                  type="email"
                  defaultValue={initial.guestEmail}
                  placeholder="guest@example.com"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Комментарий</Label>
                <Textarea
                  name="guestComment"
                  defaultValue={initial.guestComment ?? ""}
                  rows={3}
                />
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Отмена
              </Button>
            </SheetClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Сохранение…" : "Сохранить"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
