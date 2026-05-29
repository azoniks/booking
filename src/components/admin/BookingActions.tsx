"use client";

import { useRouter } from "next/navigation";
import { Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export function BookingRefundButton({
  id,
  amount,
}: {
  id: string;
  amount: string;
}) {
  const router = useRouter();
  async function doRefund() {
    if (
      !confirm(
        `Вернуть клиенту ${amount}? Бронь будет помечена как отменённая.`,
      )
    )
      return;
    const res = await fetch(`/api/admin/bookings/${id}/refund`, {
      method: "POST",
    });
    const j = await res.json();
    if (!j.ok) {
      toast({
        title: "Ошибка возврата",
        description: j.error || "Не удалось выполнить возврат",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Возврат выполнен",
      description: j.data?.mock
        ? "Mock-режим: проводки в Tinkoff не было"
        : `Tinkoff: ${j.data?.tinkoffStatus || "OK"}`,
    });
    router.refresh();
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={doRefund}
      aria-label="Вернуть средства"
      title={`Вернуть ${amount} клиенту (бронь будет отменена)`}
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Undo2 className="w-4 h-4" />
    </Button>
  );
}

export function BookingDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  async function deleteBooking() {
    if (!confirm("Удалить бронь без возможности восстановления?")) return;
    const res = await fetch(`/api/admin/bookings/${id}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) {
      toast({
        title: "Ошибка",
        description: j.error || "Не удалось удалить",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Бронь удалена" });
    router.push("/admin/bookings");
    router.refresh();
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={deleteBooking}
      aria-label="Удалить бронь"
      title="Удалить бронь без возможности восстановления"
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}

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
