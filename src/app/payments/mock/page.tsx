"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/client/SiteHeader";

function MockPayInner() {
  const params = useSearchParams();
  const router = useRouter();
  const bookingId = params.get("bookingId") || "";
  const groupId = params.get("group") || "";
  const sig = params.get("sig") || "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function process(succeeded: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/mock-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          groupId ? { groupId, sig, succeeded } : { bookingId, sig, succeeded },
        ),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Ошибка");
        return;
      }
      // Группа → success/failed?group=<code>; одиночная → ?code=<code>
      const groupCode = j.data?.groupCode || "";
      const code = j.data?.publicCode || "";
      const query = groupCode ? `?group=${groupCode}` : code ? `?code=${code}` : "";
      router.push(`/booking/${succeeded ? "success" : "failed"}${query}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-md w-full">
      <CardHeader>
        <CardTitle>Демо-оплата (mock-режим)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          В разработке Tinkoff отключён. Эта страница имитирует поведение реальной оплаты.
        </p>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <div className="flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => process(true)}>
            {busy ? "…" : "Оплатить"}
          </Button>
          <Button variant="outline" className="flex-1" disabled={busy} onClick={() => process(false)}>
            Отмена
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MockPaymentPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center p-4">
        <Suspense fallback={<p>Загрузка…</p>}>
          <MockPayInner />
        </Suspense>
      </main>
    </div>
  );
}
