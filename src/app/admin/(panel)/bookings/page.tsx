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
        group: { select: { id: true, publicCode: true, status: true, totalPrice: true } },
      },
    }),
    prisma.bookingObject.findMany({
      // Аддоны не выбираются как основной объект — только как сопутствующие.
      where: { status: "ACTIVE", isAddon: false },
      orderBy: [{ name: "asc" }],
      include: {
        objectType: {
          include: {
            category: true,
            slots: { orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }] },
          },
        },
        addons: { where: { status: "ACTIVE" }, select: { id: true, name: true } },
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
      endDayOffset: s.endDayOffset,
    })),
    addons: o.addons.map((a) => ({ id: a.id, name: a.name })),
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

  // Группируем брони: входящие в один заказ — в общий блок, остальные — по одной.
  // Порядок блоков сохраняет исходную сортировку (по дате создания, desc).
  type Item = (typeof items)[number];
  type Block =
    | { kind: "single"; booking: Item }
    | { kind: "group"; group: NonNullable<Item["group"]>; bookings: Item[] };
  const blocks: Block[] = [];
  const groupPos = new Map<string, number>();
  for (const b of items) {
    if (b.group) {
      const idx = groupPos.get(b.group.id);
      if (idx === undefined) {
        groupPos.set(b.group.id, blocks.length);
        blocks.push({ kind: "group", group: b.group, bookings: [b] });
      } else {
        (blocks[idx] as Extract<Block, { kind: "group" }>).bookings.push(b);
      }
    } else {
      blocks.push({ kind: "single", booking: b });
    }
  }

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
          <Link
            href="/admin/bookings/new-group"
            className="inline-flex items-center h-10 px-4 rounded-md border bg-secondary text-secondary-foreground hover:bg-secondary/80 text-sm whitespace-nowrap"
          >
            + Групповой заказ
          </Link>
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
        {blocks.map((blk) =>
          blk.kind === "single" ? (
            <Card key={blk.booking.id} className="hover:bg-slate-50">
              <CardContent className="p-3 flex items-center gap-2">
                <Link
                  href={`/admin/bookings/${blk.booking.id}`}
                  className="flex-1 min-w-0 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-muted-foreground">{blk.booking.publicCode}</span>
                      <span className="font-medium">{blk.booking.object.name}</span>
                      <Badge variant="outline">{blk.booking.object.objectType.category.name}</Badge>
                      <StatusBadge status={blk.booking.status} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {blk.booking.guestName} · {blk.booking.guestPhone} · {blk.booking.guestsCount} гост.
                    </div>
                  </div>
                  <div className="text-sm text-right">
                    <div>{formatLocal(blk.booking.startAt)} — {formatLocal(blk.booking.endAt)}</div>
                    <div className="font-semibold">{formatRub(blk.booking.totalPrice.toString())}</div>
                  </div>
                </Link>
                <BookingRowDelete id={blk.booking.id} publicCode={blk.booking.publicCode} />
              </CardContent>
            </Card>
          ) : (
            <Card key={blk.group.id} className="border-primary/40 bg-primary/[0.02]">
              <CardContent className="p-3 space-y-2">
                {/* Шапка заказа */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Badge variant="secondary">Заказ</Badge>
                    <span className="font-mono text-sm font-semibold">{blk.group.publicCode}</span>
                    <StatusBadge status={blk.group.status} />
                    <span className="text-xs text-muted-foreground">
                      {blk.bookings.length} объ.
                    </span>
                  </div>
                  <div className="text-sm font-semibold">
                    {formatRub(blk.group.totalPrice.toString())}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {blk.bookings[0].guestName} · {blk.bookings[0].guestPhone}
                </div>

                {/* Брони заказа */}
                <div className="divide-y rounded-md border bg-background">
                  {blk.bookings.map((b) => (
                    <Link
                      key={b.id}
                      href={`/admin/bookings/${b.id}`}
                      className="flex items-center justify-between gap-2 p-2.5 hover:bg-slate-50 first:rounded-t-md last:rounded-b-md"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{b.object.name}</span>
                          <Badge variant="outline">{b.object.objectType.category.name}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {b.guestsCount} гост. · <span className="font-mono">{b.publicCode}</span>
                        </div>
                      </div>
                      <div className="text-sm text-right shrink-0">
                        <div className="text-muted-foreground">
                          {formatLocal(b.startAt)} — {formatLocal(b.endAt)}
                        </div>
                        <div className="font-medium">{formatRub(b.totalPrice.toString())}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          ),
        )}
        {blocks.length === 0 && (
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
