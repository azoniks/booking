"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export function BookingActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  async function setStatus(s: string) {
    if (!confirm(`Изменить статус на ${s}?`)) return;
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s }),
    });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось изменить статус", variant: "destructive" });
      return;
    }
    toast({ title: "Статус изменён" });
    router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "PAID" && (
        <Button variant="default" onClick={() => setStatus("PAID")}>Подтвердить оплату</Button>
      )}
      {status !== "CANCELLED" && (
        <Button variant="destructive" onClick={() => setStatus("CANCELLED")}>Отменить</Button>
      )}
      {status !== "COMPLETED" && status === "PAID" && (
        <Button variant="outline" onClick={() => setStatus("COMPLETED")}>Завершить</Button>
      )}
      {status === "PAID" && (
        <Button variant="outline" onClick={() => setStatus("NO_SHOW")}>Не пришёл</Button>
      )}
    </div>
  );
}
