"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

type FormObject = {
  id: string;
  name: string;
  categoryName: string;
  typeName: string;
  bookingMode: "DAILY" | "HOURLY";
  checkInTime: string | null;
  checkOutTime: string | null;
  baseCapacity: number;
  maxCapacity: number;
  slots: { id: string; name: string; startTime: string; endTime: string }[];
};

export function AdminBookingCreateForm({ objects }: { objects: FormObject[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [objectId, setObjectId] = useState(objects[0]?.id || "");
  const [hourlyMode, setHourlyMode] = useState<"slot" | "custom">("slot");
  const [slotId, setSlotId] = useState("");

  const selected = useMemo(
    () => objects.find((o) => o.id === objectId),
    [objects, objectId],
  );

  if (objects.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">
        Сначала создайте активный объект
      </span>
    );
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>+ Новая бронь</Button>;
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = {
      objectId: selected.id,
      guestsCount: Number(fd.get("guestsCount") || 1),
      guestName: String(fd.get("guestName") || "").trim(),
      guestEmail: String(fd.get("guestEmail") || "").trim(),
      guestPhone: String(fd.get("guestPhone") || "").trim(),
      guestComment: String(fd.get("guestComment") || "").trim() || undefined,
      markAsPaid: fd.get("markAsPaid") === "on",
    };

    if (selected.bookingMode === "DAILY") {
      body.checkInDate = String(fd.get("checkInDate") || "");
      body.checkOutDate = String(fd.get("checkOutDate") || "");
    } else if (hourlyMode === "slot") {
      if (!slotId) {
        toast({ title: "Выберите слот", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      body.slotId = slotId;
      body.slotDate = String(fd.get("slotDate") || "");
    } else {
      const startAtLocal = String(fd.get("startAt") || "");
      const endAtLocal = String(fd.get("endAt") || "");
      if (!startAtLocal || !endAtLocal) {
        toast({ title: "Укажите начало и конец", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      body.startAt = new Date(startAtLocal).toISOString();
      body.endAt = new Date(endAtLocal).toISOString();
    }

    const res = await fetch("/api/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setSubmitting(false);
    if (!j.ok) {
      toast({
        title: "Ошибка",
        description: j.error || "Не удалось создать бронь",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Бронь создана" });
    setOpen(false);
    router.push(`/admin/bookings/${j.data.id}`);
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-3">
            <Label>Объект</Label>
            <select
              value={objectId}
              onChange={(e) => {
                setObjectId(e.target.value);
                setSlotId("");
              }}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.categoryName} → {o.typeName} → {o.name} (
                  {o.bookingMode === "DAILY" ? "сутки" : "часы"})
                </option>
              ))}
            </select>
          </div>

          {selected?.bookingMode === "DAILY" && (
            <>
              <div>
                <Label>Заезд</Label>
                <Input name="checkInDate" type="date" required />
                {selected.checkInTime && (
                  <p className="text-xs text-muted-foreground mt-1">
                    время заезда: {selected.checkInTime}
                  </p>
                )}
              </div>
              <div>
                <Label>Выезд</Label>
                <Input name="checkOutDate" type="date" required />
                {selected.checkOutTime && (
                  <p className="text-xs text-muted-foreground mt-1">
                    время выезда: {selected.checkOutTime}
                  </p>
                )}
              </div>
              <div></div>
            </>
          )}

          {selected?.bookingMode === "HOURLY" && (
            <>
              <div className="md:col-span-3 flex gap-2 items-center">
                <Label className="!mb-0">Режим:</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={hourlyMode === "slot" ? "default" : "outline"}
                    onClick={() => setHourlyMode("slot")}
                    disabled={selected.slots.length === 0}
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
                {selected.slots.length === 0 && (
                  <span className="text-xs text-muted-foreground">
                    у типа нет слотов — только произвольный интервал
                  </span>
                )}
              </div>

              {hourlyMode === "slot" && selected.slots.length > 0 ? (
                <>
                  <div className="md:col-span-2">
                    <Label>Слот</Label>
                    <select
                      value={slotId}
                      onChange={(e) => setSlotId(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                      required
                    >
                      <option value="">— выберите —</option>
                      {selected.slots.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.startTime}–{s.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Дата</Label>
                    <Input name="slotDate" type="date" required />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>Начало</Label>
                    <Input name="startAt" type="datetime-local" required />
                  </div>
                  <div>
                    <Label>Конец</Label>
                    <Input name="endAt" type="datetime-local" required />
                  </div>
                  <div></div>
                </>
              )}
            </>
          )}

          <div>
            <Label>Гостей</Label>
            <Input
              name="guestsCount"
              type="number"
              min={1}
              max={selected?.maxCapacity ?? 50}
              defaultValue={selected?.baseCapacity ?? 1}
              required
            />
            {selected && (
              <p className="text-xs text-muted-foreground mt-1">
                базово {selected.baseCapacity}, максимум {selected.maxCapacity}
              </p>
            )}
          </div>
          <div>
            <Label>Имя гостя</Label>
            <Input name="guestName" required minLength={2} />
          </div>
          <div>
            <Label>Телефон</Label>
            <Input name="guestPhone" required placeholder="+7..." />
          </div>
          <div className="md:col-span-2">
            <Label>Email (опц.)</Label>
            <Input name="guestEmail" type="email" placeholder="guest@example.com" />
          </div>
          <div className="flex items-end gap-2">
            <input
              type="checkbox"
              id="markAsPaid"
              name="markAsPaid"
              defaultChecked
              className="h-4 w-4"
            />
            <Label htmlFor="markAsPaid" className="!mb-0">
              Сразу как оплачено
            </Label>
          </div>

          <div className="md:col-span-3">
            <Label>Комментарий (опц.)</Label>
            <Textarea name="guestComment" rows={2} />
          </div>

          <div className="md:col-span-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Создание…" : "Создать бронь"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
