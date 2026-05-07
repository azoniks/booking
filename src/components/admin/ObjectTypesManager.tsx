"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type Slot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  priceOverride: string | null;
  sortOrder: number;
};

type Type = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string;
  bookingMode: "DAILY" | "HOURLY";
  checkInTime: string | null;
  checkOutTime: string | null;
  hourlyStepMinutes: number | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  minBookingHours: number | null;
  maxBookingHours: number | null;
  cleaningMinutes: number;
  baseCapacity: number;
  maxCapacity: number;
  basePrice: string;
  extraGuestPrice: string;
  paymentPercent: number | null;
  objectsCount: number;
  slots: Slot[];
};

type Category = { id: string; name: string; bookingMode: "DAILY" | "HOURLY" };

export function ObjectTypesManager({
  initialTypes,
  categories,
}: {
  initialTypes: Type[];
  categories: Category[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Type | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(form: FormData, categoryId: string, id?: string) {
    setError(null);
    // categoryId передаётся явно из локального state TypeForm: при редактировании
    // <select> отрисован как disabled и FormData его пропускает, из-за чего
    // mode скатывался в DAILY и обнулял HOURLY-поля у часовых типов.
    const cat = categories.find((c) => c.id === categoryId);
    const mode = cat?.bookingMode || "DAILY";

    const ppRaw = form.get("paymentPercent");
    const data: Record<string, unknown> = {
      name: form.get("name"),
      description: form.get("description") || null,
      cleaningMinutes: Number(form.get("cleaningMinutes") || 0),
      baseCapacity: Number(form.get("baseCapacity") || 1),
      maxCapacity: Number(form.get("maxCapacity") || 1),
      basePrice: Number(form.get("basePrice") || 0),
      extraGuestPrice: Number(form.get("extraGuestPrice") || 0),
      paymentPercent: ppRaw && String(ppRaw).trim() !== "" ? Number(ppRaw) : null,
    };
    if (!id) data.categoryId = categoryId;

    if (mode === "DAILY") {
      data.checkInTime = form.get("checkInTime") || null;
      data.checkOutTime = form.get("checkOutTime") || null;
      data.hourlyStepMinutes = null;
      data.workingHoursStart = null;
      data.workingHoursEnd = null;
      data.minBookingHours = null;
      data.maxBookingHours = null;
    } else {
      data.hourlyStepMinutes = Number(form.get("hourlyStepMinutes") || 60);
      data.workingHoursStart = form.get("workingHoursStart") || null;
      data.workingHoursEnd = form.get("workingHoursEnd") || null;
      data.minBookingHours = Number(form.get("minBookingHours") || 1);
      data.maxBookingHours = form.get("maxBookingHours") ? Number(form.get("maxBookingHours")) : null;
      data.checkInTime = null;
      data.checkOutTime = null;
    }

    const res = await fetch(id ? `/api/admin/object-types/${id}` : "/api/admin/object-types", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const j = await res.json();
    if (!j.ok) {
      setError(j.error || "Ошибка");
      return;
    }
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Удалить тип объекта?")) return;
    const res = await fetch(`/api/admin/object-types/${id}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) alert(j.error || "Ошибка");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => { setCreating(true); setEditing(null); }}>+ Новый тип</Button>
      {error && <p className="text-destructive text-sm">{error}</p>}

      {creating && (
        <Card>
          <CardContent className="p-4">
            <TypeForm
              categories={categories}
              onSubmit={(fd, catId) => save(fd, catId)}
              onCancel={() => setCreating(false)}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {initialTypes.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4">
              {editing?.id === t.id ? (
                <TypeForm
                  initial={t}
                  categories={categories}
                  onSubmit={(fd, catId) => save(fd, catId, t.id)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{t.name}</span>
                      <Badge variant="secondary">{t.categoryName}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                      {t.bookingMode === "DAILY" ? (
                        <div>Заезд {t.checkInTime} → выезд {t.checkOutTime}</div>
                      ) : (
                        <div>
                          Шаг {t.hourlyStepMinutes} мин · {t.workingHoursStart}–{t.workingHoursEnd} ·
                          мин {t.minBookingHours}ч{t.maxBookingHours ? ` / макс ${t.maxBookingHours}ч` : ""}
                        </div>
                      )}
                      <div>
                        Уборка {t.cleaningMinutes} мин · вместимость {t.baseCapacity}/{t.maxCapacity} ·
                        цена {t.basePrice} ₽ + {t.extraGuestPrice} ₽/допместо
                        {t.paymentPercent !== null && ` · предоплата ${t.paymentPercent}%`}
                      </div>
                      <div>Объектов: {t.objectsCount}</div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="icon" variant="outline" onClick={() => setEditing(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => del(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {t.bookingMode === "HOURLY" && editing?.id !== t.id && (
                <SlotsEditor typeId={t.id} initial={t.slots} />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SlotsEditor({ typeId, initial }: { typeId: string; initial: Slot[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/admin/object-types/${typeId}/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        startTime: fd.get("startTime"),
        endTime: fd.get("endTime"),
        priceOverride: fd.get("priceOverride") ? Number(fd.get("priceOverride")) : null,
        sortOrder: Number(fd.get("sortOrder") || 0),
      }),
    });
    const j = await res.json();
    if (!j.ok) {
      setError(j.error || "Ошибка");
      return;
    }
    (e.currentTarget as HTMLFormElement).reset();
    setOpen(false);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Удалить слот?")) return;
    const res = await fetch(`/api/admin/slots/${id}`, { method: "DELETE" });
    if ((await res.json()).ok) router.refresh();
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">
          Фиксированные слоты
          {initial.length === 0 && (
            <span className="text-xs text-muted-foreground font-normal ml-2">
              (если добавить хотя бы один — клиент будет видеть слоты вместо сетки часов)
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Отмена" : "+ Слот"}
        </Button>
      </div>

      {open && (
        <form onSubmit={add} className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
          <div>
            <Label className="text-xs">Название</Label>
            <Input name="name" required placeholder="День" />
          </div>
          <div>
            <Label className="text-xs">Начало</Label>
            <Input name="startTime" required placeholder="09:00" pattern="\d{2}:\d{2}" />
          </div>
          <div>
            <Label className="text-xs">Конец</Label>
            <Input name="endTime" required placeholder="21:00" pattern="\d{2}:\d{2}" />
          </div>
          <div>
            <Label className="text-xs">Цена ₽ (опц.)</Label>
            <Input name="priceOverride" type="number" step="0.01" placeholder="по basePrice" />
          </div>
          <div>
            <Label className="text-xs">Порядок</Label>
            <div className="flex gap-1">
              <Input name="sortOrder" type="number" defaultValue={initial.length} />
              <Button type="submit" size="sm">OK</Button>
            </div>
          </div>
          {error && <p className="md:col-span-5 text-sm text-destructive">{error}</p>}
        </form>
      )}

      {initial.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {initial.map((s) => {
            const [sh, sm] = s.startTime.split(":").map(Number);
            const [eh, em] = s.endTime.split(":").map(Number);
            const crosses = eh * 60 + em <= sh * 60 + sm;
            return (
              <div
                key={s.id}
                className="flex items-center justify-between p-2 rounded-md border"
              >
                <div className="text-sm">
                  <span className="font-medium">{s.name}</span>{" "}
                  <span className="text-muted-foreground">
                    {s.startTime}–{s.endTime}{crosses && " (след. день)"}
                  </span>
                  {s.priceOverride && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      · {s.priceOverride} ₽
                    </span>
                  )}
                </div>
                <Button size="icon" variant="outline" onClick={() => del(s.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TypeForm({
  initial,
  categories,
  onSubmit,
  onCancel,
}: {
  initial?: Type;
  categories: Category[];
  onSubmit: (fd: FormData, categoryId: string) => void;
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState(initial?.categoryId || categories[0]?.id || "");
  const cat = categories.find((c) => c.id === categoryId);
  const mode = cat?.bookingMode || "DAILY";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget), categoryId);
      }}
      className="grid grid-cols-1 md:grid-cols-3 gap-3"
    >
      <div className="md:col-span-2">
        <Label>Название</Label>
        <Input name="name" defaultValue={initial?.name} required />
      </div>
      <div>
        <Label>Категория</Label>
        <select
          name="categoryId"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={!!initial}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.bookingMode === "DAILY" ? "сутки" : "часы"})
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-3">
        <Label>Описание</Label>
        <Input name="description" defaultValue={initial?.description ?? ""} />
      </div>

      {mode === "DAILY" ? (
        <>
          <div>
            <Label>Время заезда</Label>
            <Input name="checkInTime" defaultValue={initial?.checkInTime ?? "14:00"} placeholder="14:00" />
          </div>
          <div>
            <Label>Время выезда</Label>
            <Input name="checkOutTime" defaultValue={initial?.checkOutTime ?? "12:00"} placeholder="12:00" />
          </div>
          <div></div>
        </>
      ) : (
        <>
          <div>
            <Label>Шаг (мин)</Label>
            <Input name="hourlyStepMinutes" type="number" defaultValue={initial?.hourlyStepMinutes ?? 60} />
          </div>
          <div>
            <Label>Работа с</Label>
            <Input name="workingHoursStart" defaultValue={initial?.workingHoursStart ?? "09:00"} placeholder="09:00" />
          </div>
          <div>
            <Label>Работа до</Label>
            <Input name="workingHoursEnd" defaultValue={initial?.workingHoursEnd ?? "23:00"} placeholder="23:00" />
          </div>
          <div>
            <Label>Мин часов</Label>
            <Input name="minBookingHours" type="number" defaultValue={initial?.minBookingHours ?? 1} />
          </div>
          <div>
            <Label>Макс часов (пусто = без)</Label>
            <Input name="maxBookingHours" type="number" defaultValue={initial?.maxBookingHours ?? ""} />
          </div>
          <div></div>
        </>
      )}

      <div>
        <Label>Уборка (мин)</Label>
        <Input name="cleaningMinutes" type="number" defaultValue={initial?.cleaningMinutes ?? 0} />
      </div>
      <div>
        <Label>Базовая вместимость</Label>
        <Input name="baseCapacity" type="number" defaultValue={initial?.baseCapacity ?? 2} />
      </div>
      <div>
        <Label>Максимум гостей</Label>
        <Input name="maxCapacity" type="number" defaultValue={initial?.maxCapacity ?? 4} />
      </div>
      <div>
        <Label>Базовая цена ({mode === "DAILY" ? "за сутки" : "за час"}), ₽</Label>
        <Input name="basePrice" type="number" step="0.01" defaultValue={initial?.basePrice ?? 0} />
      </div>
      <div>
        <Label>Доплата за допгостя, ₽</Label>
        <Input name="extraGuestPrice" type="number" step="0.01" defaultValue={initial?.extraGuestPrice ?? 0} />
      </div>
      <div>
        <Label>% предоплаты (пусто = глобально)</Label>
        <Input
          name="paymentPercent"
          type="number"
          min={1}
          max={100}
          defaultValue={initial?.paymentPercent ?? ""}
          placeholder="например, 30"
        />
      </div>

      <div className="md:col-span-3 flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
        <Button type="submit">{initial ? "Сохранить" : "Создать"}</Button>
      </div>
    </form>
  );
}
