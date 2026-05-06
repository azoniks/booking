"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isVisible: boolean;
  bookingMode: "DAILY" | "HOURLY";
  typesCount: number;
};

export function CategoriesManager({ initial }: { initial: Category[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(form: FormData, id?: string) {
    setError(null);
    const data = {
      name: form.get("name"),
      slug: form.get("slug") || undefined,
      description: form.get("description") || null,
      sortOrder: Number(form.get("sortOrder") || 0),
      isVisible: form.get("isVisible") === "on",
      bookingMode: form.get("bookingMode"),
    };
    const res = await fetch(id ? `/api/admin/categories/${id}` : "/api/admin/categories", {
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
    if (!confirm("Удалить категорию?")) return;
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) {
      alert(j.error || "Ошибка");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Button onClick={() => { setCreating(true); setEditing(null); }}>+ Новая категория</Button>
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      {creating && (
        <CategoryForm onSubmit={(fd) => save(fd)} onCancel={() => setCreating(false)} />
      )}

      <div className="grid gap-3">
        {initial.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              {editing?.id === c.id ? (
                <CategoryForm
                  initial={c}
                  onSubmit={(fd) => save(fd, c.id)}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{c.name}</span>
                      <Badge variant="secondary">{c.bookingMode === "DAILY" ? "сутки" : "часы"}</Badge>
                      {!c.isVisible && <Badge variant="outline">скрыта</Badge>}
                      <span className="text-xs text-muted-foreground">/{c.slug}</span>
                    </div>
                    {c.description && (
                      <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Порядок: {c.sortOrder} · Типов: {c.typesCount}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="icon" variant="outline" onClick={() => setEditing(c)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" onClick={() => del(c.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function CategoryForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Category;
  onSubmit: (fd: FormData) => void;
  onCancel: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="grid grid-cols-1 md:grid-cols-2 gap-3"
    >
      <div>
        <Label>Название</Label>
        <Input name="name" defaultValue={initial?.name} required />
      </div>
      <div>
        <Label>Slug (опционально)</Label>
        <Input name="slug" defaultValue={initial?.slug} placeholder="auto" />
      </div>
      <div className="md:col-span-2">
        <Label>Описание</Label>
        <Input name="description" defaultValue={initial?.description ?? ""} />
      </div>
      <div>
        <Label>Тип бронирования</Label>
        <select
          name="bookingMode"
          defaultValue={initial?.bookingMode || "DAILY"}
          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="DAILY">Сутки (номера)</option>
          <option value="HOURLY">Часы</option>
        </select>
      </div>
      <div>
        <Label>Порядок (вкладка)</Label>
        <Input name="sortOrder" type="number" defaultValue={initial?.sortOrder ?? 0} />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          name="isVisible"
          id="isVisible"
          defaultChecked={initial ? initial.isVisible : true}
        />
        <Label htmlFor="isVisible">Видна на сайте</Label>
      </div>
      <div className="md:col-span-2 flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>Отмена</Button>
        <Button type="submit">{initial ? "Сохранить" : "Создать"}</Button>
      </div>
    </form>
  );
}
