"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Pencil, Upload, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { useFormDirty } from "./_hooks";

export type Slot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  priceOverride: string | null;
  sortOrder: number;
};

export type TypeMedia = {
  id: string;
  type: "IMAGE" | "VIDEO" | "PANO360";
  url: string;
  isMain: boolean;
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
  media: TypeMedia[];
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

  async function save(form: FormData, categoryId: string, id?: string) {
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
      toast({ title: "Ошибка", description: j.error || "Не удалось сохранить", variant: "destructive" });
      return;
    }
    toast({ title: id ? "Тип сохранён" : "Тип создан" });
    setEditing(null);
    setCreating(false);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Удалить тип объекта?")) return;
    const res = await fetch(`/api/admin/object-types/${id}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось удалить", variant: "destructive" });
      return;
    }
    toast({ title: "Тип удалён" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => { setCreating(true); setEditing(null); }}>+ Новый тип</Button>

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
              {editing?.id !== t.id && (
                <>
                  <TypeMediaEditor typeId={t.id} initial={t.media} />
                  {t.bookingMode === "HOURLY" && (
                    <SlotsEditor typeId={t.id} initial={t.slots} />
                  )}
                </>
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
  const formRef = useRef<HTMLFormElement | null>(null);

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      toast({ title: "Ошибка", description: j.error || "Не удалось создать слот", variant: "destructive" });
      return;
    }
    toast({ title: "Слот создан" });
    formRef.current?.reset();
    setOpen(false);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Удалить слот?")) return;
    const res = await fetch(`/api/admin/slots/${id}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось удалить слот", variant: "destructive" });
      return;
    }
    toast({ title: "Слот удалён" });
    router.refresh();
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
        {!open && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            + Добавить слот
          </Button>
        )}
      </div>

      {open && (
        <form ref={formRef} onSubmit={add} className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
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
            <Input name="sortOrder" type="number" defaultValue={initial.length} />
          </div>
          <div className="md:col-span-5 flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" size="sm">OK</Button>
          </div>
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

function TypeMediaEditor({ typeId, initial }: { typeId: string; initial: TypeMedia[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file: File, type: TypeMedia["type"]) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    const res = await fetch(`/api/admin/object-types/${typeId}/media/upload`, {
      method: "POST",
      body: fd,
    });
    const j = await res.json();
    setUploading(false);
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось загрузить", variant: "destructive" });
      return;
    }
    toast({ title: "Загружено" });
    router.refresh();
  }

  async function setMain(mediaId: string) {
    const res = await fetch(`/api/admin/object-type-media/${mediaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isMain: true }),
    });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось обновить", variant: "destructive" });
      return;
    }
    router.refresh();
  }

  async function delMedia(mediaId: string) {
    if (!confirm("Удалить файл?")) return;
    const res = await fetch(`/api/admin/object-type-media/${mediaId}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось удалить", variant: "destructive" });
      return;
    }
    toast({ title: "Файл удалён" });
    router.refresh();
  }

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">
          Медиа типа
          <span className="text-xs text-muted-foreground font-normal ml-2">
            (используются как fallback для объектов без собственных медиа)
          </span>
        </div>
        <div>
          <input
            ref={fileInput}
            type="file"
            hidden
            accept="image/*,video/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const type: TypeMedia["type"] = f.type.startsWith("video/") ? "VIDEO" : "IMAGE";
              uploadFile(f, type);
              e.target.value = "";
            }}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="w-4 h-4 mr-1" /> {uploading ? "Загрузка…" : "Загрузить"}
          </Button>
        </div>
      </div>

      {initial.length === 0 ? (
        <p className="text-sm text-muted-foreground">Медиа нет</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {initial.map((m) => (
            <div key={m.id} className="border rounded-lg overflow-hidden">
              <div className="aspect-square bg-slate-100">
                {m.type === "VIDEO" ? (
                  <video src={m.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={m.url} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-2 flex items-center justify-between gap-1">
                <span className="text-xs text-muted-foreground">{m.type}</span>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant={m.isMain ? "default" : "outline"}
                    className="h-7 w-7"
                    onClick={() => setMain(m.id)}
                    title="Сделать главным"
                  >
                    <Star className="w-3 h-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-7 w-7"
                    onClick={() => delMedia(m.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
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
  const { dirty, formProps } = useFormDirty();
  const isEdit = !!initial;

  return (
    <form
      {...formProps}
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
          onChange={(e) => { setCategoryId(e.target.value); formProps.onChange(); }}
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
        <Button type="submit" disabled={isEdit && !dirty}>
          {isEdit ? "Сохранить" : "Создать"}
        </Button>
      </div>
    </form>
  );
}
