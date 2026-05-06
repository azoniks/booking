import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatLocal } from "@/lib/time";
import { formatRub } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const items = await prisma.booking.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      object: { include: { objectType: { include: { category: true } } } },
      payment: true,
    },
  });

  const tabs = [
    { value: "", label: "Все" },
    { value: "PENDING", label: "Ожидают" },
    { value: "PAID", label: "Оплачены" },
    { value: "CANCELLED", label: "Отменены" },
    { value: "COMPLETED", label: "Завершены" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Брони</h1>
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <Link
            key={t.value}
            href={t.value ? `/admin/bookings?status=${t.value}` : "/admin/bookings"}
            className={`px-3 py-1.5 rounded-md text-sm ${
              (status || "") === t.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      <div className="grid gap-2">
        {items.map((b) => (
          <Link key={b.id} href={`/admin/bookings/${b.id}`}>
            <Card className="hover:bg-slate-50">
              <CardContent className="p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{b.publicCode}</span>
                    <span className="font-medium">{b.object.name}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {b.guestName} · {b.guestPhone} · {b.guestsCount} гост.
                  </div>
                </div>
                <div className="text-sm text-right">
                  <div>{formatLocal(b.startAt)} — {formatLocal(b.endAt)}</div>
                  <div className="font-semibold">{formatRub(b.totalPrice.toString())}</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Нет броней</p>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
    PENDING: { label: "Ожидает", variant: "warning" },
    PAID: { label: "Оплачено", variant: "success" },
    CANCELLED: { label: "Отменено", variant: "destructive" },
    COMPLETED: { label: "Завершено", variant: "outline" },
    NO_SHOW: { label: "Не пришёл", variant: "destructive" },
  };
  const cfg = map[status] || { label: status, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
