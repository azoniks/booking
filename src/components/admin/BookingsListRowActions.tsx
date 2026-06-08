"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export function BookingRowDelete({
  id,
  publicCode,
}: {
  id: string;
  publicCode: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Удалить бронь ${publicCode}? Это действие необратимо.`)) return;
    setBusy(true);
    try {
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
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onDelete}
      disabled={busy}
      aria-label="Удалить бронь"
      title="Удалить бронь"
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}

export function BookingsBulkDelete({
  status,
  cat,
  visibleCount,
}: {
  status?: string;
  cat?: string;
  visibleCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    const filterDesc = [
      status ? `статус=${status}` : null,
      cat ? `категория` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const msg = filterDesc
      ? `Удалить ВСЕ брони по фильтру (${filterDesc})? Будет затронуто примерно ${visibleCount}+ записей. Это необратимо.`
      : `Удалить ВСЕ брони (без фильтра)? Будет удалено ${visibleCount}+ записей. Это необратимо.`;
    if (!confirm(msg)) return;
    if (!confirm("Подтвердите ещё раз: удалить выбранные брони?")) return;

    const params = new URLSearchParams();
    params.set("confirm", "1");
    if (status) params.set("status", status);
    if (cat) params.set("cat", cat);

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/bookings?${params.toString()}`, {
        method: "DELETE",
      });
      const j = await res.json();
      if (!j.ok) {
        toast({
          title: "Ошибка",
          description: j.error || "Не удалось удалить",
          variant: "destructive",
        });
        return;
      }
      toast({ title: `Удалено броней: ${j.data.deleted ?? 0}` });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy || visibleCount === 0}
      aria-label="Удалить по фильтру"
      title="Удалить по фильтру"
      className="text-destructive border-destructive/40 hover:bg-destructive/10"
    >
      <Trash2 className="w-3.5 h-3.5 sm:mr-1.5" />
      {/* На узких экранах — только иконка, чтобы ряд не выезжал за край */}
      <span className="hidden sm:inline">{busy ? "Удаление…" : "Удалить по фильтру"}</span>
    </Button>
  );
}
