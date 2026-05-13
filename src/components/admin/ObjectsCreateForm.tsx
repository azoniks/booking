"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

export function ObjectsCreateForm({
  types,
}: {
  types: { id: string; name: string; categoryName: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (types.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Сначала создайте хотя бы один тип объекта
      </p>
    );
  }

  if (!open) return <Button onClick={() => setOpen(true)}>+ Новый объект</Button>;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/objects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectTypeId: fd.get("objectTypeId"),
        name: fd.get("name"),
        slug: fd.get("slug") || undefined,
        description: fd.get("description") || null,
        sortOrder: Number(fd.get("sortOrder") || 0),
        status: "ACTIVE",
      }),
    });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось создать", variant: "destructive" });
      return;
    }
    toast({ title: "Объект создан" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label>Название</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Тип</Label>
            <select
              name="objectTypeId"
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.categoryName} → {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>Slug (опц.)</Label>
            <Input name="slug" placeholder="auto" />
          </div>
          <div className="md:col-span-2">
            <Label>Описание</Label>
            <Input name="description" />
          </div>
          <div>
            <Label>Порядок</Label>
            <Input name="sortOrder" type="number" defaultValue={0} />
          </div>
          <div className="md:col-span-3 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button type="submit">Создать</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
