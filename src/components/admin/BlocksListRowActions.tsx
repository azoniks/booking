"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

export function BlockRowDelete({
  id,
  objectName,
}: {
  id: string;
  objectName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Удалить блокировку объекта «${objectName}»? Это действие необратимо.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.ok) {
        toast({
          title: "Ошибка",
          description: j.error || "Не удалось удалить",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Блокировка удалена" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={onDelete}
      disabled={busy}
      aria-label="Удалить блокировку"
      title="Удалить блокировку"
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="w-4 h-4" />
    </Button>
  );
}

export type BlocksBulkFilters = {
  q?: string;
  cat?: string; // CSV id'шников категорий
  type?: string; // CSV id'шников типов
  obj?: string; // CSV id'шников объектов
  from?: string;
  to?: string;
  dateField?: string;
};

export function BlocksBulkDelete({
  filters,
  visibleCount,
}: {
  filters: BlocksBulkFilters;
  visibleCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    // Считаем активные фильтры (dateField — лишь модификатор периода, не фильтр).
    const hasFilters = Object.entries(filters).some(
      ([k, v]) => k !== "dateField" && v,
    );
    const msg = hasFilters
      ? `Удалить ВСЕ блокировки по текущему фильтру? Будет затронуто примерно ${visibleCount} записей. Это необратимо.`
      : `Удалить ВСЕ блокировки (без фильтра)? Будет удалено ${visibleCount} записей. Это необратимо.`;
    if (!confirm(msg)) return;
    if (!confirm("Подтвердите ещё раз: удалить выбранные блокировки?")) return;

    const params = new URLSearchParams();
    params.set("confirm", "1");
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/blocks?${params.toString()}`, {
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
      toast({ title: `Удалено блокировок: ${j.data.deleted ?? 0}` });
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
