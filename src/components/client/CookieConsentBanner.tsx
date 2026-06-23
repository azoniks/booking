"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cookieConsent:v1";

export function CookieConsentBanner({
  enabled,
  text,
  reshowDays,
}: {
  enabled: boolean;
  text: string;
  reshowDays: number;
}) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const acceptedAt = raw ? Number(raw) : NaN;
      // Показываем, если согласия ещё не было или истёк период повторного показа.
      const periodMs = Math.max(0, reshowDays) * 86_400_000;
      const expired =
        !Number.isFinite(acceptedAt) ||
        (periodMs > 0 && Date.now() - acceptedAt > periodMs);
      setVisible(expired);
    } catch {
      setVisible(true);
    }
  }, [enabled, reshowDays]);

  // Не показываем в админке — баннер только для публичной части.
  if (pathname?.startsWith("/admin")) return null;
  if (!enabled || !visible) return null;

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 pointer-events-none">
      <div className="container pointer-events-auto rounded-xl border bg-white shadow-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <p className="text-sm text-muted-foreground flex-1 leading-relaxed">
          {text}
        </p>
        <Button onClick={accept} className="shrink-0 w-full sm:w-auto">
          Принять
        </Button>
      </div>
    </div>
  );
}
