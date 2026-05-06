import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { formatLocal } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { formatRub } from "@/lib/utils";
import { BookingsTimeline } from "@/components/admin/BookingsTimeline";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const now = new Date();

  const [pendingCount, paidCount, upcoming, totalObjects, totalCategories] = await Promise.all([
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.count({ where: { status: "PAID" } }),
    // Текущие и будущие брони (включая идущие сейчас)
    prisma.booking.findMany({
      where: {
        endAt: { gte: now },
        status: { in: ["PENDING", "PAID"] },
      },
      orderBy: { startAt: "asc" },
      take: 20,
      include: { object: { include: { objectType: { include: { category: true } } } } },
    }),
    prisma.bookingObject.count(),
    prisma.category.count(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Дашборд</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">Ожидает</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">Оплачено</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">Объектов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalObjects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-normal text-muted-foreground">Категорий</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCategories}</div>
          </CardContent>
        </Card>
      </div>

      <BookingsTimeline />

      <Card>
        <CardHeader>
          <CardTitle>Ближайшие брони</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет активных или будущих броней</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((b) => (
                <Link
                  key={b.id}
                  href={`/admin/bookings/${b.id}`}
                  className="flex items-center justify-between p-3 rounded-md border hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.object.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.guestName} · {b.guestPhone}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div>{formatLocal(b.startAt)}</div>
                    <div className="flex items-center gap-2 justify-end mt-1">
                      <span className="text-muted-foreground text-xs">
                        {formatRub(b.totalPrice.toString())}
                      </span>
                      <StatusBadge status={b.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
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
