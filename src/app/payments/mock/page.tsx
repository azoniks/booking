"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function MockPayInner() {
  const params = useSearchParams();
  const router = useRouter();
  const bookingId = params.get("bookingId") || "";
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
        body: JSON.stringify({ bookingId, sig, succeeded }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error || "Ошибка");
        return;
      }
      const code = j.data?.publicCode || "";
      if (succeeded) {
        router.push(`/booking/success${code ? `?code=${code}` : ""}`);
      } else {
        router.push(`/booking/failed${code ? `?code=${code}` : ""}`);
      }
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
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Suspense fallback={<p>Загрузка…</p>}>
        <MockPayInner />
      </Suspense>
    </div>
  );
}
