"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

type FormObject = {
  id: string;
  name: string;
  categoryName: string;
  typeName: string;
  bookingMode: "DAILY" | "HOURLY" | "FULL_DAY";
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
    } else if (selected.bookingMode === "FULL_DAY") {
      const date = String(fd.get("bookingDate") || "");
      if (!date) {
        toast({ title: "Укажите дату", variant: "destructive" });
        setSubmitting(false);
        return;
      }
      body.bookingDate = date;
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>+ Новая бронь</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Новая бронь</SheetTitle>
          <SheetDescription>
            Создание брони от имени администратора. Email клиенту не отправляется.
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={onSubmit}
          className="flex flex-1 flex-col min-h-0"
          id="admin-booking-create-form"
        >
          <SheetBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <Label>Объект</Label>
                <ObjectSearchPicker
                  objects={objects}
                  value={objectId}
                  onChange={(id) => {
                    setObjectId(id);
                    setSlotId("");
                  }}
                />
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
                </>
              )}

              {selected?.bookingMode === "FULL_DAY" && (
                <div className="md:col-span-2">
                  <Label>Дата</Label>
                  <Input name="bookingDate" type="date" required />
                  <p className="text-xs text-muted-foreground mt-1">
                    бронь на весь рабочий день
                  </p>
                </div>
              )}

              {selected?.bookingMode === "HOURLY" && (
                <>
                  <div className="md:col-span-2 flex gap-2 items-center flex-wrap">
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
                      <div>
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
              <div>
                <Label>Email (опц.)</Label>
                <Input name="guestEmail" type="email" placeholder="guest@example.com" />
              </div>

              <div className="md:col-span-2 flex items-center gap-2">
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

              <div className="md:col-span-2">
                <Label>Комментарий (опц.)</Label>
                <Textarea name="guestComment" rows={3} />
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
              {submitting ? "Создание…" : "Создать бронь"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function modeLabel(m: FormObject["bookingMode"]): string {
  return m === "DAILY" ? "сутки" : m === "FULL_DAY" ? "день" : "часы";
}

function ObjectSearchPicker({
  objects,
  value,
  onChange,
}: {
  objects: FormObject[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hoverIdx, setHoverIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => objects.find((o) => o.id === value),
    [objects, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return objects;
    return objects.filter((o) =>
      `${o.categoryName} ${o.typeName} ${o.name}`.toLowerCase().includes(q),
    );
  }, [objects, query]);

  // Закрытие при клике вне
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function selectObj(o: FormObject) {
    onChange(o.id);
    setQuery("");
    setOpen(false);
  }

  const displayValue =
    open || !selected
      ? query
      : `${selected.categoryName} → ${selected.typeName} → ${selected.name}`;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHoverIdx(0);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
            setHoverIdx(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setHoverIdx((i) => Math.min(filtered.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHoverIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const item = filtered[hoverIdx];
              if (item) selectObj(item);
            } else if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder={
            selected ? "Поиск по объектам…" : "Начните вводить название или категорию"
          }
          className="pl-9 pr-9"
          autoComplete="off"
        />
        {selected && (
          <button
            type="button"
            aria-label="Сменить объект"
            title="Сменить объект"
            onMouseDown={(e) => {
              e.preventDefault();
              onChange("");
              setQuery("");
              setOpen(true);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              Ничего не найдено
            </div>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectObj(o);
                }}
                onMouseEnter={() => setHoverIdx(i)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 ${
                  i === hoverIdx ? "bg-accent text-accent-foreground" : ""
                } ${o.id === value ? "font-medium" : ""}`}
              >
                <span className="truncate">
                  <span className="text-muted-foreground">
                    {o.categoryName} → {o.typeName} →
                  </span>{" "}
                  {o.name}
                </span>
                <Badge variant="outline" className="shrink-0 text-[10px] font-normal">
                  {modeLabel(o.bookingMode)}
                </Badge>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
