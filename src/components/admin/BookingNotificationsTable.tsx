"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLocal } from "@/lib/time";

type Notification = {
  id: string;
  channel: string;
  kind: string;
  recipient: string;
  status: string;
  error: string | null;
  sentAt: Date | string;
};

const PREVIEW_COUNT = 5;

const CHANNEL_LABEL: Record<string, string> = {
  EMAIL: "Email",
  TELEGRAM: "Telegram",
  MAX: "MAX",
};

const KIND_LABEL: Record<string, string> = {
  admin_new_booking: "Админу: новая бронь",
  admin_paid: "Админу: оплачено",
  guest_paid: "Гостю: оплачено",
  payment_retry: "Гостю: повторная оплата",
  reminder_24h: "Напоминание за сутки",
  status_pending: "Статус: ожидает",
  status_paid: "Статус: оплачено",
  status_cancelled: "Статус: отменено",
  status_completed: "Статус: завершено",
  status_no_show: "Статус: не пришёл",
};

function labelKind(kind: string): string {
  return KIND_LABEL[kind] || kind;
}

function StatusCell({ status, error }: { status: string; error: string | null }) {
  if (status === "sent") {
    return <Badge variant="success">Отправлено</Badge>;
  }
  if (status === "failed") {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <Badge variant="destructive">Ошибка</Badge>
        {error && (
          <span className="text-[10px] text-muted-foreground max-w-[240px] truncate" title={error}>
            {error}
          </span>
        )}
      </span>
    );
  }
  return <Badge variant="secondary">{status}</Badge>;
}

export function BookingNotificationsTable({
  notifications,
}: {
  notifications: Notification[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? notifications : notifications.slice(0, PREVIEW_COUNT);
  const hiddenCount = notifications.length - PREVIEW_COUNT;

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 w-[140px]">Время</TableHead>
            <TableHead className="h-8 w-[110px]">Канал</TableHead>
            <TableHead className="h-8">Событие</TableHead>
            <TableHead className="h-8">Получатель</TableHead>
            <TableHead className="h-8 w-[130px]">Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((n) => (
            <TableRow key={n.id}>
              <TableCell className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                {formatLocal(typeof n.sentAt === "string" ? new Date(n.sentAt) : n.sentAt)}
              </TableCell>
              <TableCell className="py-1.5">
                <Badge variant="outline" className="font-normal">
                  {CHANNEL_LABEL[n.channel] || n.channel}
                </Badge>
              </TableCell>
              <TableCell className="py-1.5">{labelKind(n.kind)}</TableCell>
              <TableCell className="py-1.5 font-mono text-xs text-muted-foreground truncate max-w-[200px]">
                {n.recipient}
              </TableCell>
              <TableCell className="py-1.5">
                <StatusCell status={n.status} error={n.error} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {hiddenCount > 0 && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs"
          >
            {expanded ? "Свернуть" : `Показать ещё ${hiddenCount}`}
          </Button>
        </div>
      )}
    </div>
  );
}
