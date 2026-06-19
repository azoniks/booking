"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { formatLocal } from "@/lib/time";
import { toast } from "@/components/ui/use-toast";

type Block = {
  id: string;
  objectId: string;
  objectName: string;
  startAt: string;
  endAt: string;
  reason: string | null;
};

export function BlocksManager({
  initial,
  objects,
}: {
  initial: Block[];
  objects: { id: string; name: string; categoryName: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const allSelected = objects.length > 0 && selected.length === objects.length;

  function toggleOne(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  function toggleAll() {
    setSelected(allSelected ? [] : objects.map((o) => o.id));
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (selected.length === 0) {
      toast({ title: "Выберите хотя бы один объект", variant: "destructive" });
      return;
    }
    const fd = new FormData(e.currentTarget);
    const startLocal = String(fd.get("startAt"));
    const endLocal = String(fd.get("endAt"));
    const res = await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectIds: selected,
        startAt: new Date(startLocal).toISOString(),
        endAt: new Date(endLocal).toISOString(),
        reason: fd.get("reason") || null,
      }),
    });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось создать", variant: "destructive" });
      return;
    }
    toast({ title: `Блокировок создано: ${j.data?.count ?? selected.length}` });
    setOpen(false);
    setSelected([]);
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("Удалить блокировку?")) return;
    const res = await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось удалить", variant: "destructive" });
      return;
    }
    toast({ title: "Блокировка удалена" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setOpen((v) => !v)}>+ Новая блокировка</Button>
      {open && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <div className="flex items-center justify-between">
                  <Label>Объекты ({selected.length} из {objects.length})</Label>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-sm text-primary underline"
                  >
                    {allSelected ? "Снять все" : "Выбрать все"}
                  </button>
                </div>
                <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-input p-2 space-y-1">
                  {objects.map((o) => (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 text-sm cursor-pointer rounded px-1 py-0.5 hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={selected.includes(o.id)}
                        onChange={() => toggleOne(o.id)}
                      />
                      <span>{o.categoryName} — {o.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label>Начало</Label>
                <Input name="startAt" type="datetime-local" required />
              </div>
              <div>
                <Label>Конец</Label>
                <Input name="endAt" type="datetime-local" required />
              </div>
              <div className="md:col-span-3">
                <Label>Причина</Label>
                <Input name="reason" placeholder="Ремонт" />
              </div>
              <div className="md:col-span-3 flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
                <Button type="submit">Создать</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {initial.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{b.objectName}</div>
                <div className="text-sm text-muted-foreground">
                  {formatLocal(new Date(b.startAt))} — {formatLocal(new Date(b.endAt))}
                </div>
                {b.reason && <div className="text-sm">{b.reason}</div>}
              </div>
              <Button size="icon" variant="outline" onClick={() => del(b.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {initial.length === 0 && <p className="text-sm text-muted-foreground">Блокировок нет</p>}
      </div>
    </div>
  );
}
