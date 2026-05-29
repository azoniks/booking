"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function formatRetry(sec: number): string {
  if (sec <= 0) return "несколько минут";
  const m = Math.ceil(sec / 60);
  if (m <= 1) return "минуту";
  if (m < 5) return `${m} минуты`;
  return `${m} минут`;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/admin";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    if (res?.error) {
      try {
        const r = await fetch("/api/auth/login-status", { cache: "no-store" });
        const j = await r.json();
        if (j.blocked) {
          setError(
            `Слишком много неудачных попыток. Повторите через ${formatRetry(j.retryAfterSec)}.`,
          );
          setLoading(false);
          return;
        }
      } catch {
        // ignore, fall through to generic message
      }
      setError("Неверный email или пароль");
      setLoading(false);
      return;
    }
    setLoading(false);
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <Label htmlFor="password">Пароль</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Вход…" : "Войти"}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Вход в админку</CardTitle>
          <CardDescription>Доступ для администраторов сайта</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<p>Загрузка…</p>}>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
