"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

/** Переключатель отметки «разобрано» у одной записи ошибки. */
export function ResolveErrorButton({
  id,
  resolved,
}: {
  id: string;
  resolved: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/error-logs/${id}/resolve`, { method: "POST" });
      const j = await res.json();
      if (!j.ok) {
        toast({ title: "Ошибка", description: j.error || "Не удалось", variant: "destructive" });
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={busy}
      title={resolved ? "Снять отметку" : "Отметить разобранным"}
      className="text-xs"
    >
      {resolved ? (
        <>
          <RotateCcw className="w-3.5 h-3.5 mr-1" /> Вернуть
        </>
      ) : (
        <>
          <Check className="w-3.5 h-3.5 mr-1" /> Разобрано
        </>
      )}
    </Button>
  );
}

/** Очистка лога ошибок: только разобранные или все (с подтверждением). */
export function ClearErrorsButton({ total }: { total: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function clear(scope: "resolved" | "all") {
    if (scope === "all") {
      if (!confirm(`Удалить ВСЕ записи лога ошибок (${total})? Это необратимо.`)) return;
    } else if (!confirm("Удалить все разобранные записи?")) return;

    const qs = scope === "resolved" ? "?scope=resolved" : "?confirm=1";
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/error-logs${qs}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.ok) {
        toast({ title: "Ошибка", description: j.error || "Не удалось", variant: "destructive" });
        return;
      }
      toast({ title: `Удалено записей: ${j.data.deleted ?? 0}` });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => clear("resolved")}
        disabled={busy}
      >
        Очистить разобранные
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => clear("all")}
        disabled={busy || total === 0}
        className="text-destructive border-destructive/40 hover:bg-destructive/10"
      >
        <Trash2 className="w-3.5 h-3.5 mr-1" /> Очистить всё
      </Button>
    </div>
  );
}
