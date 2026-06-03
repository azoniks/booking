"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import {
  ObjectSchedulePicker,
  type ScheduleState,
} from "@/components/client/ObjectSchedulePicker";

type ObjOption = {
  id: string;
  name: string;
  categoryName: string;
  typeName: string;
  isAddon: boolean;
  addons: { id: string; name: string }[];
};

export function AdminGroupCreateForm({ objects }: { objects: ObjOption[] }) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, ScheduleState>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [comment, setComment] = useState("");
  const [markAsPaid, setMarkAsPaid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(objects.map((o) => [o.id, o])), [objects]);
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
          markAsPaid,
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
          <select
            value=""
            onChange={(e) => addObject(e.target.value)}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            disabled={available.length === 0}
          >
            <option value="">
              {available.length === 0 ? "Все объекты добавлены" : "— выберите объект —"}
            </option>
            {available.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.categoryName} / {o.typeName}
              </option>
            ))}
          </select>
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
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7…" required />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Email (необязательно)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Комментарий (необязательно)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={markAsPaid} onChange={(e) => setMarkAsPaid(e.target.checked)} />
            Отметить заказ оплаченным (без Tinkoff)
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          Объектов: <b>{selectedIds.length}</b> · Итого: <b>{fmt(totalPrice)} ₽</b>
        </div>
        <Button disabled={!canSubmit} onClick={submit}>
          {submitting ? "Создаём…" : markAsPaid ? "Создать заказ (оплачен)" : "Создать заказ"}
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
