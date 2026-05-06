"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Channels = {
  telegram: { enabled: boolean; botUsername: string };
  max: { enabled: boolean; botUsername: string };
};

export function MessengerOptIn({ publicCode }: { publicCode: string }) {
  const [ch, setCh] = useState<Channels | null>(null);
  useEffect(() => {
    fetch("/api/public/notification-channels")
      .then((r) => r.json())
      .then((j) => j.ok && setCh(j.data))
      .catch(() => null);
  }, []);

  if (!ch) return null;
  if (!ch.telegram.enabled && !ch.max.enabled) return null;

  return (
    <div className="border-t pt-3 space-y-2">
      <p className="text-sm font-medium">Получать уведомления в мессенджере</p>
      <div className="flex flex-wrap gap-2">
        {ch.telegram.enabled && (
          <Button asChild variant="outline" size="sm">
            <a
              href={`https://t.me/${ch.telegram.botUsername}?start=${publicCode}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Подключить Telegram
            </a>
          </Button>
        )}
        {ch.max.enabled && (
          <Button asChild variant="outline" size="sm">
            <a
              href={`https://max.ru/${ch.max.botUsername}?start=${publicCode}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Подключить MAX
            </a>
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        После нажатия откроется чат с ботом — нажмите «Старт» чтобы получать напоминание о брони.
      </p>
    </div>
  );
}
