"use client";

import { useState } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * На мобиле прячет фильтры под кнопку-тоггл «Фильтры» (с индикатором активных).
 * На ширине ≥sm фильтры показаны всегда, кнопка скрыта.
 */
export function CollapsibleFilters({
  activeCount = 0,
  children,
}: {
  activeCount?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      {/* Тоггл — только на мобиле */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="sm:hidden inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-background text-sm hover:bg-slate-50"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Фильтры
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs">
            {activeCount}
          </span>
        )}
        <ChevronDown
          className={cn("w-4 h-4 transition-transform", open && "rotate-180")}
        />
      </button>

      {/* Содержимое: скрыто на мобиле пока не раскрыто; на ≥sm всегда видно */}
      <div className={cn("space-y-2", !open && "hidden", "sm:block")}>
        {children}
      </div>
    </div>
  );
}
