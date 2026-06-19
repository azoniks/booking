"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  ObjectSchedulePicker,
  type ScheduleState,
} from "@/components/client/ObjectSchedulePicker";
import type { CartSchedule } from "@/components/client/CartProvider";
import {
  ObjectSortSelect,
  sortObjects,
  DEFAULT_OBJECT_SORT,
  type ObjectSort,
} from "./objectSort";

type ObjOption = {
  id: string;
  name: string;
  categoryName: string;
  typeName: string;
  baseCapacity: number;
  basePrice: number;
  isAddon: boolean;
  addons: { id: string; name: string }[];
};

export function AdminGroupCreateForm({
  objects,
  initialDate,
}: {
  objects: ObjOption[];
  /** Предзаполнить дату заезда/начала для добавляемых объектов (YYYY-MM-DD). */
  initialDate?: string;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, ScheduleState>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  // Две галочки оплаты: полная оплата приоритетнее аванса.
  const [prepaidMade, setPrepaidMade] = useState(false);
  const [fullyPaid, setFullyPaid] = useState(false);
  const paymentState = fullyPaid ? "paid" : prepaidMade ? "prepaid" : "none";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects]);

  // Предзаполнение даты для добавляемых объектов. Режим объекта заранее неизвестен,
  // поэтому кладём дату во все поля, не требующие второй даты — ObjectSchedulePicker
  // возьмёт только подходящие своему режиму (checkOutDate НЕ задаём: суточному
  // range без выезда не предзаполнится — админ выберет даты сам).
  const initialSchedule = useMemo<CartSchedule | undefined>(() => {
    if (!initialDate) return undefined;
    return {
      checkInDate: initialDate,
      bookingDate: initialDate,
      slotDate: initialDate,
      startAt: `${initialDate}T12:00:00`,
    };
  }, [initialDate]);
  // В основном выборе — только самостоятельные объекты; аддоны добавляются
  // кнопкой под родителем.
  const available = objects.filter((o) => !o.isAddon && !selectedIds.includes(o.id));

  const handleItemChange = useCallback((s: ScheduleState) => {
    setStates((prev) => ({ ...prev, [s.objectId]: s }));
  }, []);

  function addObject(id: string) {
    if (!id || selectedIds.includes(id)) return;
    setSelectedIds((prev) => [...prev, id]);
  }
  function removeObject(id: string) {
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    setStates((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const totalPrice = selectedIds.reduce((s, id) => s + (states[id]?.price || 0), 0);
  const allValid = selectedIds.length > 0 && selectedIds.every((id) => states[id]?.valid);
  const contactValid = name.trim().length >= 2 && phone.trim().length >= 1;
  const canSubmit = allValid && contactValid && !submitting;
  const fmt = (n: number) => n.toLocaleString("ru-RU");

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const items = selectedIds
        .map((id) => states[id]?.payload)
        .filter(Boolean) as Record<string, unknown>[];
      const res = await fetch("/api/admin/booking-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: name,
          guestEmail: email,
          guestPhone: phone,
          guestComment: comment,
          paymentState,
          items,
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Не удалось создать заказ");
        return;
      }
      toast({ title: "Заказ создан", description: `Код: ${j.data.publicCode}` });
      router.push("/admin/bookings");
      router.refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label>Добавить объект в заказ</Label>
          <ObjectAddPicker objects={available} onAdd={addObject} />
        </CardContent>
      </Card>

      {selectedIds.map((id) => {
        const o = byId.get(id);
        // Сопутствующие объекты этого объекта, ещё не добавленные в заказ.
        const suggest = (o?.addons ?? []).filter((a) => !selectedIds.includes(a.id));
        return (
          <div key={id} className="space-y-2">
            <ObjectSchedulePicker
              objectId={id}
              objectName={o ? `${o.name} · ${o.categoryName}` : id}
              suppressParentNotice
              initial={initialSchedule}
              onChange={handleItemChange}
              onRemove={() => removeObject(id)}
            />
            {suggest.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pl-1">
                <span className="text-xs text-muted-foreground">Сопутствующие:</span>
                {suggest.map((a) => (
                  <Button
                    key={a.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => addObject(a.id)}
                  >
                    + {a.name}
                  </Button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Card>
        <CardContent className="p-4 grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Имя гостя</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label className="text-xs">Телефон</Label>
            <PhoneInput value={phone} onChange={setPhone} required />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Email (необязательно)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Комментарий (необязательно)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-xs">Оплата</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={prepaidMade}
                  onChange={(e) => setPrepaidMade(e.target.checked)}
                />
                Аванс внесён
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={fullyPaid}
                  onChange={(e) => setFullyPaid(e.target.checked)}
                />
                Полностью оплачено
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Если ничего не отмечено — заказ не оплачен (без Tinkoff).
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          Объектов: <b>{selectedIds.length}</b> · Итого: <b>{fmt(totalPrice)} ₽</b>
        </div>
        <Button disabled={!canSubmit} onClick={submit}>
          {submitting
            ? "Создаём…"
            : fullyPaid
              ? "Создать заказ (оплачен)"
              : prepaidMade
                ? "Создать заказ (аванс)"
                : "Создать заказ"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!allValid && selectedIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Заполните дату/время и число гостей для каждого объекта.
        </p>
      )}
    </div>
  );
}

/**
 * Поиск по объектам для добавления в групповой заказ. В отличие от пикера
 * одиночной брони, выбор не «запоминается» — объект добавляется в заказ и поле
 * очищается, позволяя сразу искать следующий.
 */
function ObjectAddPicker({
  objects,
  onAdd,
}: {
  objects: ObjOption[];
  onAdd: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hoverIdx, setHoverIdx] = useState(0);
  const [sort, setSort] = useState<ObjectSort>(DEFAULT_OBJECT_SORT);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? objects.filter((o) =>
          `${o.categoryName} ${o.typeName} ${o.name}`.toLowerCase().includes(q),
        )
      : objects;
    return sortObjects(base, sort);
  }, [objects, query, sort]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(o: ObjOption) {
    onAdd(o.id);
    setQuery("");
    setHoverIdx(0);
    inputRef.current?.focus();
  }

  const disabled = objects.length === 0;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHoverIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
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
              if (item) pick(item);
            } else if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder={
            disabled ? "Все объекты добавлены" : "Поиск по названию или категории…"
          }
          className="pl-9"
          autoComplete="off"
        />
      </div>

      {open && !disabled && (
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
                  pick(o);
                }}
                onMouseEnter={() => setHoverIdx(i)}
                className={`w-full text-left px-3 py-2 text-sm ${
                  i === hoverIdx ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                }`}
              >
                <span className="truncate">
                  {o.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {o.categoryName} → {o.typeName}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
