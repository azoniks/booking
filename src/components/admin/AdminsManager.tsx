"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatLocal } from "@/lib/time";

type Admin = {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  lastLoginAt: string | null;
};

export function AdminsManager({
  initial,
  currentUserId,
}: {
  initial: Admin[];
  currentUserId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        name: fd.get("name"),
        password: fd.get("password"),
      }),
    });
    const j = await res.json();
    if (!j.ok) {
      setError(j.error || "Ошибка");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function toggle(a: Admin) {
    const res = await fetch(`/api/admin/admins/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !a.isActive }),
    });
    if ((await res.json()).ok) router.refresh();
  }

  async function resetPassword(id: string) {
    const pw = prompt("Новый пароль (минимум 8 символов):");
    if (!pw || pw.length < 8) return;
    const res = await fetch(`/api/admin/admins/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    if ((await res.json()).ok) alert("Пароль изменён");
  }

  return (
    <div className="space-y-4">
      <Button onClick={() => setOpen((v) => !v)}>+ Новый администратор</Button>
      {open && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Email</Label>
                <Input name="email" type="email" required />
              </div>
              <div>
                <Label>Имя</Label>
                <Input name="name" required />
              </div>
              <div>
                <Label>Пароль (мин 8)</Label>
                <Input name="password" type="password" minLength={8} required />
              </div>
              {error && <p className="text-destructive text-sm md:col-span-3">{error}</p>}
              <div className="md:col-span-3 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
                <Button type="submit">Создать</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {initial.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-sm text-muted-foreground">{a.email}</span>
                  {a.isActive ? <Badge variant="success">активен</Badge> : <Badge variant="destructive">отключён</Badge>}
                  {currentUserId === a.id && <Badge variant="outline">это вы</Badge>}
                </div>
                {a.lastLoginAt && (
                  <div className="text-xs text-muted-foreground">
                    Последний вход: {formatLocal(new Date(a.lastLoginAt))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => resetPassword(a.id)}>
                  Сменить пароль
                </Button>
                {currentUserId !== a.id && (
                  <Button size="sm" variant="outline" onClick={() => toggle(a)}>
                    {a.isActive ? "Отключить" : "Включить"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
