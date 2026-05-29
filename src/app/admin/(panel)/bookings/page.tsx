import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatLocal } from "@/lib/time";
import { formatRub } from "@/lib/utils";
import { AdminBookingCreateForm } from "@/components/admin/AdminBookingCreateForm";
import {
  BookingRowDelete,
  BookingsBulkDelete,
} from "@/components/admin/BookingsListRowActions";

export const dynamic = "force-dynamic";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; cat?: string }>;
}) {
  const { status, cat } = await searchParams;
  const [items, objects, categories] = await Promise.all([
    prisma.booking.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(cat
          ? { object: { objectType: { categoryId: cat } } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        object: { include: { objectType: { include: { category: true } } } },
        payment: true,
      },
    }),
    prisma.bookingObject.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      include: {
        objectType: {
          include: {
            category: true,
            slots: { orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }] },
          },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const formObjects = objects.map((o) => ({
    id: o.id,
    name: o.name,
    categoryName: o.objectType.category.name,
    typeName: o.objectType.name,
    bookingMode: o.objectType.category.bookingMode,
    checkInTime: o.objectType.checkInTime,
    checkOutTime: o.objectType.checkOutTime,
    baseCapacity: o.objectType.baseCapacity,
    maxCapacity: o.objectType.maxCapacity,
    slots: o.objectType.slots.map((s) => ({
      id: s.id,
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  }));

  const statusTabs = [
    { value: "", label: "Все" },
    { value: "PENDING", label: "Ожидают" },
    { value: "PAID", label: "Оплачены" },
    { value: "CANCELLED", label: "Отменены" },
    { value: "COMPLETED", label: "Завершены" },
  ];

  const buildHref = (next: { status?: string; cat?: string }) => {
    const params = new URLSearchParams();
    if (next.status) params.set("status", next.status);
    if (next.cat) params.set("cat", next.cat);
    const qs = params.toString();
    return qs ? `/admin/bookings?${qs}` : "/admin/bookings";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Брони</h1>
        <div className="flex items-center gap-2">
          <BookingsBulkDelete
            status={status}
            cat={cat}
            visibleCount={items.length}
          />
          <AdminBookingCreateForm objects={formObjects} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {statusTabs.map((t) => (
            <Link
              key={t.value || "all"}
              href={buildHref({ status: t.value || undefined, cat })}
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

        {categories.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            <Link
              href={buildHref({ status, cat: undefined })}
              className={`px-3 py-1.5 rounded-md text-sm border ${
                !cat
                  ? "bg-primary/10 text-primary border-primary"
                  : "bg-background text-muted-foreground hover:bg-slate-50 border-input"
              }`}
            >
              Все категории
            </Link>
            {categories.map((c) => (
              <Link
                key={c.id}
                href={buildHref({ status, cat: c.id })}
                className={`px-3 py-1.5 rounded-md text-sm border ${
                  cat === c.id
                    ? "bg-primary/10 text-primary border-primary"
                    : "bg-background text-muted-foreground hover:bg-slate-50 border-input"
                }`}
              >
                {c.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-2">
        {items.map((b) => (
          <Card key={b.id} className="hover:bg-slate-50">
            <CardContent className="p-3 flex items-center gap-2">
              <Link
                href={`/admin/bookings/${b.id}`}
                className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{b.publicCode}</span>
                    <span className="font-medium">{b.object.name}</span>
                    <Badge variant="outline">{b.object.objectType.category.name}</Badge>
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
              </Link>
              <BookingRowDelete id={b.id} publicCode={b.publicCode} />
            </CardContent>
          </Card>
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
