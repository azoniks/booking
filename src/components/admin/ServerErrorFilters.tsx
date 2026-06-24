"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SOURCE_LABELS, SOURCE_VALUES } from "@/lib/server-error-filters";

const PATH = "/admin/logs";
// tab сохраняем при смене фильтров (страница общая с аудитом).
const FILTER_KEYS = ["from", "to", "source", "q", "unresolved"] as const;

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ServerErrorFilters({
  current,
}: {
  current: {
    from?: string;
    to?: string;
    source?: string;
    q?: string;
    unresolved?: string;
  };
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [search, setSearch] = useState(current.q ?? "");
  useEffect(() => setSearch(current.q ?? ""), [current.q]);

  function setParams(updates: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    sp.set("tab", "errors");
    for (const [key, value] of Object.entries(updates)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    const qs = sp.toString();
    router.push(qs ? `${PATH}?${qs}` : PATH);
  }

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const trimmed = search.trim();
    if (trimmed === (current.q ?? "")) return;
    const t = setTimeout(() => setParams({ q: trimmed || undefined }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const activeCount = FILTER_KEYS.filter(
    (k) => (current as Record<string, string | undefined>)[k],
  ).length;

  function preset(from: string, to: string) {
    setParams({ from, to });
  }

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
            onClick={() => setParams(Object.fromEntries(FILTER_KEYS.map((k) => [k, undefined])))}
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Сбросить всё
          </Button>
        )}
      </div>

      {/* Поиск */}
      <div>
        <Label className="text-xs">Поиск</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="По тексту ошибки или пути"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              preset(ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(now));
            }}
          >
            Этот месяц
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

      {/* Источник + только неразобранные */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48">
          <Label className="text-xs">Источник</Label>
          <select
            value={current.source ?? ""}
            onChange={(e) => setParams({ source: e.target.value || undefined })}
            className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">Все источники</option>
            {SOURCE_VALUES.map((v) => (
              <option key={v} value={v}>
                {SOURCE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm h-10">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={current.unresolved === "1"}
            onChange={(e) => setParams({ unresolved: e.target.checked ? "1" : undefined })}
          />
          Только неразобранные
        </label>
      </div>
    </div>
  );
}
