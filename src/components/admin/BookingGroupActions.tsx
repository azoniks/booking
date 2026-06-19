"use client";

import { useRouter } from "next/navigation";
import { Undo2, XCircle, Trash2, Wallet, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

// Смена статуса оплаты заказа (PREPAID/PAID) через PATCH /booking-groups/[id].
function GroupSetStatusButton({
  id,
  status,
  label,
  icon,
  confirmText,
}: {
  id: string;
  status: "PREPAID" | "PAID";
  label: string;
  icon: React.ReactNode;
  confirmText: string;
}) {
  const router = useRouter();
  async function doSet() {
    if (!confirm(confirmText)) return;
    const res = await fetch(`/api/admin/booking-groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось", variant: "destructive" });
      return;
    }
    toast({ title: "Статус заказа обновлён" });
    router.refresh();
  }
  return (
    <Button type="button" variant={status === "PAID" ? "default" : "outline"} onClick={doSet}>
      {icon} {label}
    </Button>
  );
}

export function GroupMarkPrepaidButton({ id }: { id: string }) {
  return (
    <GroupSetStatusButton
      id={id}
      status="PREPAID"
      label="Аванс внесён"
      icon={<Wallet className="w-4 h-4 mr-2" />}
      confirmText="Отметить аванс по всему заказу внесённым?"
    />
  );
}

export function GroupMarkPaidButton({ id }: { id: string }) {
  return (
    <GroupSetStatusButton
      id={id}
      status="PAID"
      label="Подтвердить полную оплату"
      icon={<CheckCircle2 className="w-4 h-4 mr-2" />}
      confirmText="Подтвердить полную оплату по всему заказу?"
    />
  );
}

export function GroupRefundButton({ id, amount }: { id: string; amount: string }) {
  const router = useRouter();
  async function doRefund() {
    if (!confirm(`Вернуть клиенту ${amount} по всему заказу? Все брони заказа будут отменены.`)) return;
    const res = await fetch(`/api/admin/booking-groups/${id}/refund`, { method: "POST" });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка возврата", description: j.error || "Не удалось", variant: "destructive" });
      return;
    }
    toast({
      title: "Возврат выполнен",
      description: j.data?.mock ? "Mock-режим: проводки в Tinkoff не было" : `Tinkoff: ${j.data?.tinkoffStatus || "OK"}`,
    });
    router.refresh();
  }
  return (
    <Button type="button" variant="destructive" onClick={doRefund}>
      <Undo2 className="w-4 h-4 mr-2" /> Вернуть и отменить заказ
    </Button>
  );
}

export function GroupCancelButton({ id }: { id: string }) {
  const router = useRouter();
  async function doCancel() {
    if (!confirm("Отменить весь заказ? Все брони заказа будут отменены.")) return;
    const res = await fetch(`/api/admin/booking-groups/${id}/cancel`, { method: "POST" });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось отменить", variant: "destructive" });
      return;
    }
    toast({ title: "Заказ отменён" });
    router.refresh();
  }
  return (
    <Button type="button" variant="destructive" onClick={doCancel}>
      <XCircle className="w-4 h-4 mr-2" /> Отменить заказ
    </Button>
  );
}

export function GroupDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  async function doDelete() {
    if (!confirm("Удалить заказ и все его брони без возможности восстановления?")) return;
    const res = await fetch(`/api/admin/booking-groups/${id}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) {
      toast({ title: "Ошибка", description: j.error || "Не удалось удалить", variant: "destructive" });
      return;
    }
    toast({ title: "Заказ удалён" });
    router.push("/admin/bookings");
    router.refresh();
  }
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={doDelete}
      title="Удалить заказ со всеми бронями"
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}
