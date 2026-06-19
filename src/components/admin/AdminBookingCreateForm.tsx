"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Plus } from "lucide-react";
import {
  ObjectSchedulePicker,
  type ScheduleState,
} from "@/components/client/ObjectSchedulePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
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
import { formatSlotEndSuffix } from "@/lib/slots";
import {
  ObjectSortSelect,
  sortObjects,
  DEFAULT_OBJECT_SORT,
  type ObjectSort,
} from "./objectSort";

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
  basePrice: number;
  slots: {
    id: string;
    name: string;
    startTime: string;
    endTime: string;
    endDayOffset: number;
  }[];
  addons: { id: string; name: string }[];
};

export function AdminBookingCreateForm({
  objects,
  open: openProp,
  onOpenChange,
  hideTrigger = false,
  initialDate,
}: {
  objects: FormObject[];
  /** Controlled-режим: если передан open/onOpenChange — состоянием управляет родитель. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Скрыть встроенный триггер-кнопку (когда форму открывают снаружи). */
  hideTrigger?: boolean;
  /** Предзаполнить дату заезда/начала (YYYY-MM-DD). */
  initialDate?: string;
}) {
  const router = useRouter();
  // Controlled, если родитель передал open+onOpenChange; иначе внутренний state.
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setOpenInternal(next);
  };
  const [submitting, setSubmitting] = useState(false);
  const [objectId, setObjectId] = useState(objects[0]?.id || "");
  const [hourlyMode, setHourlyMode] = useState<"slot" | "custom">("slot");
  const [slotId, setSlotId] = useState("");
  // Значение даты заезда/начала — управляемое, чтобы предзаполнять из initialDate.
  const [dateValue, setDateValue] = useState(initialDate ?? "");
  // Сопутствующие объекты (аддоны): отмеченные + их расписание из ObjectSchedulePicker.
  const [checkedAddons, setCheckedAddons] = useState<string[]>([]);
  const [addonStates, setAddonStates] = useState<Record<string, ScheduleState>>({});

  const selected = useMemo(
    () => objects.find((o) => o.id === objectId),
    [objects, objectId],
  );

  // При открытии формы с новой initialDate подставляем её в поле даты.
  useEffect(() => {
    if (open && initialDate) setDateValue(initialDate);
  }, [open, initialDate]);

  const handleAddonChange = useCallback((s: ScheduleState) => {
    setAddonStates((prev) => ({ ...prev, [s.objectId]: s }));
  }, []);

  // Открываем нативный календарь по клику в любом месте поля (а не только по иконке).
  const openPicker = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
    try {
      el.showPicker?.();
    } catch {
      // showPicker может бросить вне user-gesture или если не поддерживается — игнорируем.
    }
  }, []);

  function toggleAddon(id: string) {
    setCheckedAddons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

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
    const fd = new FormData(e.currentTarget);
    const guestsCount = Number(fd.get("guestsCount") || 1);
    const guest = {
      guestName: String(fd.get("guestName") || "").trim(),
      guestEmail: String(fd.get("guestEmail") || "").trim(),
      guestPhone: String(fd.get("guestPhone") || "").trim(),
      guestComment: String(fd.get("guestComment") || "").trim() || undefined,
    };
    // Две галочки оплаты: полная оплата приоритетнее аванса.
    const fullyPaid = fd.get("fullyPaid") === "on";
    const prepaidMade = fd.get("prepaidMade") === "on";
    const paymentState = fullyPaid ? "paid" : prepaidMade ? "prepaid" : "none";

    // Расписание основного объекта (фрагмент без гостевых данных).
    const mainItem: Record<string, unknown> = { objectId: selected.id, guestsCount };
    if (selected.bookingMode === "DAILY") {
      mainItem.checkInDate = String(fd.get("checkInDate") || "");
      mainItem.checkOutDate = String(fd.get("checkOutDate") || "");
    } else if (selected.bookingMode === "FULL_DAY") {
      const date = String(fd.get("bookingDate") || "");
      if (!date) {
        toast({ title: "Укажите дату", variant: "destructive" });
        return;
      }
      mainItem.bookingDate = date;
    } else if (hourlyMode === "slot") {
      if (!slotId) {
        toast({ title: "Выберите слот", variant: "destructive" });
        return;
      }
      mainItem.slotId = slotId;
      mainItem.slotDate = String(fd.get("slotDate") || "");
    } else {
      const startAtLocal = String(fd.get("startAt") || "");
      const endAtLocal = String(fd.get("endAt") || "");
      if (!startAtLocal || !endAtLocal) {
        toast({ title: "Укажите начало и конец", variant: "destructive" });
        return;
      }
      mainItem.startAt = new Date(startAtLocal).toISOString();
      mainItem.endAt = new Date(endAtLocal).toISOString();
    }

    // Сопутствующие объекты, отмеченные галочкой.
    const addonItems: Record<string, unknown>[] = [];
    for (const id of checkedAddons) {
      const st = addonStates[id];
      if (!st || !st.valid || !st.payload) {
        toast({ title: "Заполните даты/время сопутствующего объекта", variant: "destructive" });
        return;
      }
      addonItems.push(st.payload);
    }

    setSubmitting(true);
    try {
      if (addonItems.length > 0) {
        // Групповой заказ: основной объект + сопутствующие, один заказ.
        const res = await fetch("/api/admin/booking-groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...guest, paymentState, items: [mainItem, ...addonItems] }),
        });
        const j = await res.json();
        if (!j.ok) {
          toast({ title: "Ошибка", description: j.error || "Не удалось создать заказ", variant: "destructive" });
          return;
        }
        toast({ title: "Заказ создан", description: `Код: ${j.data.publicCode}` });
        setOpen(false);
        router.push("/admin/bookings");
        router.refresh();
      } else {
        // Одиночная бронь.
        const res = await fetch("/api/admin/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...mainItem, ...guest, paymentState }),
        });
        const j = await res.json();
        if (!j.ok) {
          toast({ title: "Ошибка", description: j.error || "Не удалось создать бронь", variant: "destructive" });
          return;
        }
        toast({ title: "Бронь создана" });
        setOpen(false);
        router.push(`/admin/bookings/${j.data.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <SheetTrigger asChild>
          <Button size="icon" aria-label="Новая бронь" title="Новая бронь">
            <Plus className="w-5 h-5" />
          </Button>
        </SheetTrigger>
      )}
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
                    setCheckedAddons([]);
                    setAddonStates({});
                  }}
                />
              </div>

              {selected?.bookingMode === "DAILY" && (
                <>
                  <div>
                    <Label>Заезд</Label>
                    <Input
                      name="checkInDate"
                      type="date"
                      required
                      value={dateValue}
                      onChange={(e) => setDateValue(e.target.value)}
                      onClick={openPicker}
                    />
                    {selected.checkInTime && (
                      <p className="text-xs text-muted-foreground mt-1">
                        время заезда: {selected.checkInTime}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Выезд</Label>
                    <Input name="checkOutDate" type="date" required onClick={openPicker} />
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
                  <Input
                    name="bookingDate"
                    type="date"
                    required
                    value={dateValue}
                    onChange={(e) => setDateValue(e.target.value)}
                    onClick={openPicker}
                  />
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
                              {s.name} ({s.startTime}–{s.endTime}{formatSlotEndSuffix(s.endDayOffset)})
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
                          value={dateValue}
                          onChange={(e) => setDateValue(e.target.value)}
                          onClick={openPicker}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label>Начало</Label>
                        <Input name="startAt" type="datetime-local" required onClick={openPicker} />
                      </div>
                      <div>
                        <Label>Конец</Label>
                        <Input name="endAt" type="datetime-local" required onClick={openPicker} />
                      </div>
                    </>
                  )}
                </>
              )}

              {selected && selected.addons.length > 0 && (
                <div className="md:col-span-2 border-t pt-3 space-y-2">
                  <Label className="!mb-0">Сопутствующие объекты</Label>
                  <p className="text-xs text-muted-foreground">
                    Можно добавить к этой брони — оформится одним заказом.
                  </p>
                  {selected.addons.map((a) => {
                    const checked = checkedAddons.includes(a.id);
                    return (
                      <div key={a.id} className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddon(a.id)}
                          />
                          Добавить: {a.name}
                        </label>
                        {checked && (
                          <ObjectSchedulePicker
                            objectId={a.id}
                            objectName={a.name}
                            suppressParentNotice
                            onChange={handleAddonChange}
                            onRemove={() => toggleAddon(a.id)}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
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
                <PhoneInput name="guestPhone" required />
              </div>
              <div>
                <Label>Email (опц.)</Label>
                <Input name="guestEmail" type="email" placeholder="guest@example.com" />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label className="!mb-0">Оплата</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="prepaidMade"
                      className="h-4 w-4"
                    />
                    Аванс внесён
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="fullyPaid"
                      className="h-4 w-4"
                    />
                    Полностью оплачено
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Если ничего не отмечено — бронь не оплачена.
                </p>
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
  const [sort, setSort] = useState<ObjectSort>(DEFAULT_OBJECT_SORT);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selected = useMemo(
    () => objects.find((o) => o.id === value),
    [objects, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? objects.filter((o) =>
          `${o.categoryName} ${o.typeName} ${o.name}`.toLowerCase().includes(q),
        )
      : objects;
    return sortObjects(base, sort);
  }, [objects, query, sort]);

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
      : `${selected.name} · ${selected.categoryName} → ${selected.typeName}`;

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
          onClick={() => {
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
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-white px-2 py-1.5">
            <span className="text-xs text-muted-foreground">Сортировка</span>
            <ObjectSortSelect value={sort} onChange={setSort} />
          </div>
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
                  i === hoverIdx ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                } ${o.id === value ? "font-medium" : ""}`}
              >
                <span className="truncate">
                  {o.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {o.categoryName} → {o.typeName}
                  </span>
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
