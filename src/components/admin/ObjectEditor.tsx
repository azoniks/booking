"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Trash2, Upload } from "lucide-react";

type Media = {
  id: string;
  type: "IMAGE" | "VIDEO" | "PANO360";
  url: string;
  isMain: boolean;
  sortOrder: number;
};

export function ObjectEditor({
  obj,
  types,
}: {
  obj: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    status: string;
    sortOrder: number;
    objectTypeId: string;
    categoryName: string;
    typeName: string;
    media: Media[];
  };
  types: { id: string; name: string; categoryName: string }[];
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function saveBasics(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/admin/objects/${obj.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        description: fd.get("description") || null,
        status: fd.get("status"),
        sortOrder: Number(fd.get("sortOrder") || 0),
        objectTypeId: fd.get("objectTypeId"),
      }),
    });
    const j = await res.json();
    if (!j.ok) {
      setError(j.error || "Ошибка");
      return;
    }
    router.refresh();
  }

  async function uploadFile(file: File, type: Media["type"]) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("objectId", obj.id);
    fd.append("type", type);
    const res = await fetch("/api/admin/media/upload", { method: "POST", body: fd });
    const j = await res.json();
    setUploading(false);
    if (!j.ok) {
      alert(j.error || "Ошибка");
      return;
    }
    router.refresh();
  }

  async function setMain(mediaId: string) {
    const res = await fetch(`/api/admin/media/${mediaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isMain: true }),
    });
    if ((await res.json()).ok) router.refresh();
  }

  async function delMedia(mediaId: string) {
    if (!confirm("Удалить файл?")) return;
    const res = await fetch(`/api/admin/media/${mediaId}`, { method: "DELETE" });
    if ((await res.json()).ok) router.refresh();
  }

  async function deleteObject() {
    if (!confirm("Удалить объект целиком? Это удалит все медиа.")) return;
    const res = await fetch(`/api/admin/objects/${obj.id}`, { method: "DELETE" });
    if ((await res.json()).ok) router.push("/admin/objects");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/objects" className="text-sm text-muted-foreground hover:underline">
            ← Все объекты
          </Link>
          <h1 className="text-2xl font-bold mt-1">{obj.name}</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant="secondary">{obj.categoryName}</Badge>
            <Badge variant="outline">{obj.typeName}</Badge>
          </div>
        </div>
        <Button variant="destructive" onClick={deleteObject}>Удалить объект</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Основное</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveBasics} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Название</Label>
              <Input name="name" defaultValue={obj.name} required />
            </div>
            <div>
              <Label>Тип</Label>
              <select
                name="objectTypeId"
                defaultValue={obj.objectTypeId}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.categoryName} → {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <Label>Описание</Label>
              <Textarea name="description" defaultValue={obj.description ?? ""} rows={4} />
            </div>
            <div>
              <Label>Статус</Label>
              <select
                name="status"
                defaultValue={obj.status}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ACTIVE">Активен</option>
                <option value="HIDDEN">Скрыт</option>
                <option value="MAINTENANCE">Обслуживание</option>
              </select>
            </div>
            <div>
              <Label>Порядок</Label>
              <Input name="sortOrder" type="number" defaultValue={obj.sortOrder} />
            </div>
            {error && <p className="text-destructive text-sm md:col-span-3">{error}</p>}
            <div className="md:col-span-3 flex justify-end">
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Медиа</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <input
                ref={fileInput}
                type="file"
                hidden
                accept="image/*,video/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const type: Media["type"] = f.type.startsWith("video/") ? "VIDEO" : "IMAGE";
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
        </CardHeader>
        <CardContent>
          {obj.media.length === 0 ? (
            <p className="text-sm text-muted-foreground">Медиа нет</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {obj.media.map((m) => (
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
        </CardContent>
      </Card>
    </div>
  );
}
