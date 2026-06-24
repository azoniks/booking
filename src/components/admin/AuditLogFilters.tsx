"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ENTITY_LABELS,
  ACTION_LABELS,
  ENTITY_VALUES,
  ACTION_VALUES,
} from "@/lib/audit-filters";

const PATH = "/admin/logs";
const FILTER_KEYS = ["from", "to", "entity", "action", "actor"] as const;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AuditLogFilters({
  actors,
  current,
}: {
  actors: { id: string; name: string }[];
  current: {
    from?: string;
    to?: string;
    entity?: string;
    action?: string;
    actor?: string;
  };
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParams(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    const qs = sp.toString();
    router.push(qs ? `${PATH}?${qs}` : PATH);
  }

  const activeCount = FILTER_KEYS.filter(
    (k) => (current as Record<string, string | undefined>)[k],
  ).length;

  function preset(from: string, to: string) {
    setParams({ from, to });
  }
  function presetThisMonth() {
    const now = new Date();
    preset(ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now));
  }
  function presetLastMonth() {
    const now = new Date();
    preset(
      ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
    );
  }
  function presetThisYear() {
    const now = new Date();
    preset(ymd(new Date(now.getFullYear(), 0, 1)), ymd(now));
  }

  const selectCls =
    "w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Срез данных</h2>
        {activeCount > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() =>
              setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))
            }
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Сбросить всё
          </Button>
        )}
      </div>

      {/* Период */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
        <div>
          <Label className="text-xs">С</Label>
          <Input
            type="date"
            value={current.from ?? ""}
            max={current.to || undefined}
            onChange={(e) => setParams({ from: e.target.value || undefined })}
            className="w-auto"
          />
        </div>
        <div>
          <Label className="text-xs">По</Label>
          <Input
            type="date"
            value={current.to ?? ""}
            min={current.from || undefined}
            onChange={(e) => setParams({ to: e.target.value || undefined })}
            className="w-auto"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={presetThisMonth}>
            Этот месяц
          </Button>
          <Button variant="outline" size="sm" onClick={presetLastMonth}>
            Прошлый месяц
          </Button>
          <Button variant="outline" size="sm" onClick={presetThisYear}>
            Этот год
          </Button>
          {(current.from || current.to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setParams({ from: undefined, to: undefined })}
            >
              Сброс
            </Button>
          )}
        </div>
      </div>

      {/* Раздел / Действие / Автор */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Раздел</Label>
          <select
            value={current.entity ?? ""}
            onChange={(e) => setParams({ entity: e.target.value || undefined })}
            className={selectCls}
          >
            <option value="">Все разделы</option>
            {ENTITY_VALUES.map((v) => (
              <option key={v} value={v}>
                {ENTITY_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Действие</Label>
          <select
            value={current.action ?? ""}
            onChange={(e) => setParams({ action: e.target.value || undefined })}
            className={selectCls}
          >
            <option value="">Все действия</option>
            {ACTION_VALUES.map((v) => (
              <option key={v} value={v}>
                {ACTION_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-xs">Автор</Label>
          <select
            value={current.actor ?? ""}
            onChange={(e) => setParams({ actor: e.target.value || undefined })}
            className={selectCls}
          >
            <option value="">Все авторы</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
