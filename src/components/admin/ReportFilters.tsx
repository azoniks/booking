"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ReportFilters({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [fromVal, setFromVal] = useState(from);
  const [toVal, setToVal] = useState(to);

  function apply(f: string, t: string) {
    if (!f || !t) return;
    router.push(`/admin/reports?from=${f}&to=${t}`);
  }

  function presetThisMonth() {
    const now = new Date();
    const f = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    const t = ymd(now);
    setFromVal(f);
    setToVal(t);
    apply(f, t);
  }

  function presetLastMonth() {
    const now = new Date();
    const f = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const t = ymd(new Date(now.getFullYear(), now.getMonth(), 0)); // последний день прошлого месяца
    setFromVal(f);
    setToVal(t);
    apply(f, t);
  }

  function presetThisYear() {
    const now = new Date();
    const f = ymd(new Date(now.getFullYear(), 0, 1));
    const t = ymd(now);
    setFromVal(f);
    setToVal(t);
    apply(f, t);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
      <div>
        <Label className="text-xs">С</Label>
        <Input
          type="date"
          value={fromVal}
          max={toVal || undefined}
          onChange={(e) => setFromVal(e.target.value)}
          className="w-auto"
        />
      </div>
      <div>
        <Label className="text-xs">По</Label>
        <Input
          type="date"
          value={toVal}
          min={fromVal || undefined}
          onChange={(e) => setToVal(e.target.value)}
          className="w-auto"
        />
      </div>
      <Button onClick={() => apply(fromVal, toVal)} disabled={!fromVal || !toVal || fromVal > toVal}>
        Применить
      </Button>
      <div className="flex flex-wrap gap-2 sm:ml-2">
        <Button variant="outline" size="sm" onClick={presetThisMonth}>
          Этот месяц
        </Button>
        <Button variant="outline" size="sm" onClick={presetLastMonth}>
          Прошлый месяц
        </Button>
        <Button variant="outline" size="sm" onClick={presetThisYear}>
          Этот год
        </Button>
      </div>
    </div>
  );
}
