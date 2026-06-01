"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Pencil, Upload, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { useFormDirty } from "./_hooks";
import { RichTextEditor } from "./RichTextEditor";
import {
  SLOT_END_DAY_OPTIONS,
  formatSlotEndSuffix,
  slotDurationHours,
} from "@/lib/slots";

export type Slot = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  endDayOffset: number;
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
  bookingMode: "DAILY" | "HOURLY" | "FULL_DAY";
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
  paymentType: "PERCENT" | "FIXED";
  paymentPercent: number | null;
  paymentAmount: string | null;
  sortOrder: number;
  sectionsTotal: number | null;
  sectionCapacity: number | null;
  sectionsBookingMax: number | null;
  fullVenuePrice: string | null;
  objectsCount: number;
  slots: Slot[];
  media: TypeMedia[];
};

type Category = { id: string; name: string; bookingMode: "DAILY" | "HOURLY" | "FULL_DAY" };

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
  const [activeCat, setActiveCat] = useState<string>("ALL");
  const visibleTypes =
    activeCat === "ALL"
      ? initialTypes
      : initialTypes.filter((t) => t.categoryId === activeCat);
  const createDefaultCat =
    activeCat !== "ALL" ? activeCat : undefined;

  async function save(form: FormData, categoryId: string, id?: string) {
    // categoryId передаётся явно из локального state TypeForm: при редактировании
    // <select> отрисован как disabled и FormData его пропускает, из-за чего
    // mode скатывался в DAILY и обнулял HOURLY-поля у часовых типов.
    const cat = categories.find((c) => c.id === categoryId);
    const mode = cat?.bookingMode || "DAILY";

    const optInt = (key: string): number | null => {
      const raw = form.get(key);
      const s = raw == null ? "" : String(raw).trim();
      return s === "" ? null : Number(s);
    };
    const optDecimal = (key: string): number | null => {
      const raw = form.get(key);
      const s = raw == null ? "" : String(raw).trim();
      return s === "" ? null : Number(s);
    };
    const paymentType = (form.get("paymentType") as "PERCENT" | "FIXED") || "PERCENT";
    const data: Record<string, unknown> = {
      name: form.get("name"),
      description: form.get("description") || null,
      cleaningMinutes: Number(form.get("cleaningMinutes") || 0),
      baseCapacity: Number(form.get("baseCapacity") || 1),
      maxCapacity: Number(form.get("maxCapacity") || 1),
      basePrice: Number(form.get("basePrice") || 0),
      extraGuestPrice: Number(form.get("extraGuestPrice") || 0),
      sortOrder: Number(form.get("sortOrder") || 0),
      paymentType,
      // В FIXED режиме paymentPercent очищаем, в PERCENT — paymentAmount.
      paymentPercent: paymentType === "PERCENT" ? optInt("paymentPercent") : null,
      paymentAmount: paymentType === "FIXED" ? optDecimal("paymentAmount") : null,
    };
    if (!id) data.categoryId = categoryId;

    // Секции — только для FULL_DAY. Для остальных режимов всегда null.
    if (mode === "FULL_DAY") {
      data.sectionsTotal = optInt("sectionsTotal");
      data.sectionCapacity = optInt("sectionCapacity");
      data.sectionsBookingMax = optInt("sectionsBookingMax");
      data.fullVenuePrice = optDecimal("fullVenuePrice");
    } else {
      data.sectionsTotal = null;
      data.sectionCapacity = null;
      data.sectionsBookingMax = null;
      data.fullVenuePrice = null;
    }

    if (mode === "DAILY") {
      data.checkInTime = form.get("checkInTime") || null;
      data.checkOutTime = form.get("checkOutTime") || null;
      data.hourlyStepMinutes = null;
      data.workingHoursStart = null;
      data.workingHoursEnd = null;
      data.minBookingHours = null;
      data.maxBookingHours = null;
    } else if (mode === "FULL_DAY") {
      // День: только рабочие часы (с/до), всё остальное обнуляем.
      data.workingHoursStart = form.get("workingHoursStart") || null;
      data.workingHoursEnd = form.get("workingHoursEnd") || null;
      data.checkInTime = null;
      data.checkOutTime = null;
      data.hourlyStepMinutes = null;
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
      {categories.length > 0 && (
        <Tabs value={activeCat} onValueChange={setActiveCat}>
          <TabsList>
            <TabsTrigger value="ALL">Все ({initialTypes.length})</TabsTrigger>
            {categories.map((c) => {
              const count = initialTypes.filter((t) => t.categoryId === c.id).length;
              return (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.name} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      <Button onClick={() => { setCreating(true); setEditing(null); }}>+ Новый тип</Button>

      {creating && (
        <Card>
          <CardContent className="p-4">
            <TypeForm
              categories={categories}
              defaultCategoryId={createDefaultCat}
              onSubmit={(fd, catId) => save(fd, catId)}
              onCancel={() => setCreating(false)}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {visibleTypes.length === 0 && (
          <p className="text-sm text-muted-foreground">В этой категории пока нет типов</p>
        )}
        {visibleTypes.map((t) => (
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
                      ) : t.bookingMode === "FULL_DAY" ? (
                        <div>Весь день: {t.workingHoursStart}–{t.workingHoursEnd}</div>
                      ) : (
                        <div>
                          Шаг {t.hourlyStepMinutes} мин · {t.workingHoursStart}–{t.workingHoursEnd} ·
                          мин {t.minBookingHours}ч{t.maxBookingHours ? ` / макс ${t.maxBookingHours}ч` : ""}
                        </div>
                      )}
                      <div>
                        Уборка {t.cleaningMinutes} мин · вместимость {t.baseCapacity}/{t.maxCapacity} ·
                        цена {t.basePrice} ₽ + {t.extraGuestPrice} ₽/допместо
                        {t.paymentType === "FIXED" && t.paymentAmount
                          ? ` · предоплата ${t.paymentAmount} ₽`
                          : t.paymentPercent !== null
                            ? ` · предоплата ${t.paymentPercent}%`
                            : ""}
                      </div>
                      {t.sectionsTotal && t.sectionCapacity && (
                        <div>
                          {t.sectionsTotal} секций × {t.sectionCapacity} чел.
                          {t.sectionsBookingMax != null && ` · до ${t.sectionsBookingMax} секций отдельно`}
                          {t.fullVenuePrice && ` · вся площадка ${t.fullVenuePrice} ₽`}
                        </div>
                      )}
                      <div>Объектов: {t.objectsCount} · Порядок: {t.sortOrder}</div>
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
                  {/* Слоты только для HOURLY; FULL_DAY и DAILY их не используют. */}
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
        endDayOffset: Number(fd.get("endDayOffset") || 0),
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
        <form ref={formRef} onSubmit={add} className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
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
            <Label className="text-xs">Конец слота</Label>
            <select
              name="endDayOffset"
              defaultValue={0}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {SLOT_END_DAY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Цена ₽ (опц.)</Label>
            <Input name="priceOverride" type="number" step="0.01" placeholder="по basePrice" />
          </div>
          <div>
            <Label className="text-xs">Порядок</Label>
            <Input name="sortOrder" type="number" defaultValue={initial.length} />
          </div>
          <div className="col-span-2 md:col-span-6 flex gap-2 justify-end">
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" size="sm">OK</Button>
          </div>
        </form>
      )}

      {initial.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {initial.map((s) => (
            <SlotRow key={s.id} slot={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function SlotRow({ slot }: { slot: Slot }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const priceRaw = fd.get("priceOverride");
    const priceTrim = priceRaw == null ? "" : String(priceRaw).trim();
    const res = await fetch(`/api/admin/slots/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        startTime: fd.get("startTime"),
        endTime: fd.get("endTime"),
        endDayOffset: Number(fd.get("endDayOffset") || 0),
        priceOverride: priceTrim !== "" ? Number(priceTrim) : null,
        sortOrder: Number(fd.get("sortOrder") || 0),
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (!j.ok) {
      toast({
        title: "Ошибка",
        description: j.error || "Не удалось сохранить слот",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Слот сохранён" });
    setEditing(false);
    router.refresh();
  }

  async function del() {
    if (!confirm("Удалить слот?")) return;
    const res = await fetch(`/api/admin/slots/${slot.id}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) {
      toast({
        title: "Ошибка",
        description: j.error || "Не удалось удалить слот",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Слот удалён" });
    router.refresh();
  }

  if (editing) {
    return (
      <form
        onSubmit={save}
        className="md:col-span-2 grid grid-cols-2 md:grid-cols-6 gap-2 p-2 rounded-md border bg-slate-50"
      >
        <div>
          <Label className="text-xs">Название</Label>
          <Input name="name" required defaultValue={slot.name} />
        </div>
        <div>
          <Label className="text-xs">Начало</Label>
          <Input
            name="startTime"
            required
            defaultValue={slot.startTime}
            pattern="\d{2}:\d{2}"
          />
        </div>
        <div>
          <Label className="text-xs">Конец</Label>
          <Input
            name="endTime"
            required
            defaultValue={slot.endTime}
            pattern="\d{2}:\d{2}"
          />
        </div>
        <div>
          <Label className="text-xs">Конец слота</Label>
          <select
            name="endDayOffset"
            defaultValue={slot.endDayOffset}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {SLOT_END_DAY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Цена ₽ (опц.)</Label>
          <Input
            name="priceOverride"
            type="number"
            step="0.01"
            defaultValue={slot.priceOverride ?? ""}
            placeholder="по basePrice"
          />
        </div>
        <div>
          <Label className="text-xs">Порядок</Label>
          <Input name="sortOrder" type="number" defaultValue={slot.sortOrder} />
        </div>
        <div className="col-span-2 md:col-span-6 flex gap-2 justify-end">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing(false)}
            disabled={busy}
          >
            Отмена
          </Button>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Сохранение…" : "Сохранить"}
          </Button>
        </div>
      </form>
    );
  }

  const durationH = slotDurationHours(slot);

  return (
    <div className="flex items-center justify-between p-2 rounded-md border gap-2">
      <div className="text-sm min-w-0">
        <span className="font-medium">{slot.name}</span>{" "}
        <span className="text-muted-foreground">
          {slot.startTime}–{slot.endTime}
          {formatSlotEndSuffix(slot.endDayOffset)}
        </span>
        {durationH > 0 && (
          <span className="ml-2 text-xs text-muted-foreground">· {durationH} ч</span>
        )}
        {slot.priceOverride && (
          <span className="ml-2 text-xs text-muted-foreground">
            · {slot.priceOverride} ₽
          </span>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="icon"
          variant="outline"
          onClick={() => setEditing(true)}
          aria-label="Редактировать"
        >
          <Pencil className="w-3 h-3" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={del}
          aria-label="Удалить"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
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
        <div>
          <div className="text-sm font-semibold">
            Медиа типа
            <span className="text-xs text-muted-foreground font-normal ml-2">
              (используются как fallback для объектов без собственных медиа)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Картинки до 25 МБ, видео до 200 МБ (mp4/webm/mov).
          </p>
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
  defaultCategoryId,
  onSubmit,
  onCancel,
}: {
  initial?: Type;
  categories: Category[];
  defaultCategoryId?: string;
  onSubmit: (fd: FormData, categoryId: string) => void;
  onCancel: () => void;
}) {
  const [categoryId, setCategoryId] = useState(
    initial?.categoryId || defaultCategoryId || categories[0]?.id || "",
  );
  const cat = categories.find((c) => c.id === categoryId);
  const mode = cat?.bookingMode || "DAILY";
  const [paymentType, setPaymentType] = useState<"PERCENT" | "FIXED">(
    initial?.paymentType || "PERCENT",
  );
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
              {c.name} ({c.bookingMode === "DAILY" ? "сутки" : c.bookingMode === "FULL_DAY" ? "день" : "часы"})
            </option>
          ))}
        </select>
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
      ) : mode === "FULL_DAY" ? (
        <>
          <div>
            <Label>Работа с</Label>
            <Input name="workingHoursStart" defaultValue={initial?.workingHoursStart ?? "09:00"} placeholder="09:00" />
          </div>
          <div>
            <Label>Работа до</Label>
            <Input name="workingHoursEnd" defaultValue={initial?.workingHoursEnd ?? "21:00"} placeholder="21:00" />
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
        <Label>Базовая цена ({mode === "DAILY" ? "за сутки" : mode === "FULL_DAY" ? "за день" : "за час"}), ₽</Label>
        <Input name="basePrice" type="number" step="0.01" defaultValue={initial?.basePrice ?? 0} />
      </div>
      <div>
        <Label>Доплата за допгостя, ₽</Label>
        <Input name="extraGuestPrice" type="number" step="0.01" defaultValue={initial?.extraGuestPrice ?? 0} />
      </div>
      <div>
        <Label>Порядок</Label>
        <Input name="sortOrder" type="number" defaultValue={initial?.sortOrder ?? 0} />
      </div>
      <div className="md:col-span-3 border rounded-md p-3 bg-slate-50/50 space-y-3">
        <div className="text-sm font-semibold">Предоплата</div>
        <input type="hidden" name="paymentType" value={paymentType} />
        <div className="flex gap-2 flex-wrap">
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              checked={paymentType === "PERCENT"}
              onChange={() => { setPaymentType("PERCENT"); formProps.onChange(); }}
            />
            % от суммы
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="radio"
              checked={paymentType === "FIXED"}
              onChange={() => { setPaymentType("FIXED"); formProps.onChange(); }}
            />
            Фиксированная сумма
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {paymentType === "PERCENT" ? (
            <div>
              <Label className="text-xs">% предоплаты (пусто = глобально)</Label>
              <Input
                name="paymentPercent"
                type="number"
                min={1}
                max={100}
                defaultValue={initial?.paymentPercent ?? ""}
                placeholder="например, 30"
              />
            </div>
          ) : (
            <div>
              <Label className="text-xs">Фикс. сумма предоплаты, ₽</Label>
              <Input
                name="paymentAmount"
                type="number"
                step="0.01"
                min={0}
                required
                defaultValue={initial?.paymentAmount ?? ""}
                placeholder="например, 1000"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Если больше суммы брони — спишется только сумма брони.
              </p>
            </div>
          )}
        </div>
      </div>

      {mode === "FULL_DAY" && (
        <div className="md:col-span-3 border rounded-md p-3 bg-slate-50/50 space-y-3">
          <div className="text-sm font-semibold">
            Секции (банкетные площадки)
            <span className="text-xs text-muted-foreground font-normal ml-2">
              оставьте пустыми, чтобы не использовать секционную бронь
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Всего секций</Label>
              <Input
                name="sectionsTotal"
                type="number"
                min={2}
                max={100}
                defaultValue={initial?.sectionsTotal ?? ""}
                placeholder="напр. 15"
              />
            </div>
            <div>
              <Label className="text-xs">Вместимость секции</Label>
              <Input
                name="sectionCapacity"
                type="number"
                min={1}
                max={100}
                defaultValue={initial?.sectionCapacity ?? ""}
                placeholder="напр. 10"
              />
            </div>
            <div>
              <Label className="text-xs">Макс. секций по отдельности</Label>
              <Input
                name="sectionsBookingMax"
                type="number"
                min={1}
                max={100}
                defaultValue={initial?.sectionsBookingMax ?? ""}
                placeholder="напр. 6 (выше → вся площадка)"
              />
            </div>
            <div>
              <Label className="text-xs">Цена за всю площадку, ₽</Label>
              <Input
                name="fullVenuePrice"
                type="number"
                step="0.01"
                min={0}
                defaultValue={initial?.fullVenuePrice ?? ""}
                placeholder="пусто = basePrice × всего секций"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            «Базовая цена» в этом случае = цена за одну секцию.
          </p>
        </div>
      )}

      <div className="md:col-span-3">
        <Label>Описание</Label>
        <RichTextEditor
          name="description"
          defaultValue={initial?.description ?? ""}
          placeholder="Например: уютный номер с видом на сад"
          maxLength={5000}
          onChange={formProps.onChange}
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
