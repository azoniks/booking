import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocal } from "@/lib/time";
import { formatRub } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  BookingActions,
  BookingDeleteButton,
  BookingRefundButton,
} from "@/components/admin/BookingActions";
import {
  GroupRefundButton,
  GroupCancelButton,
  GroupDeleteButton,
} from "@/components/admin/BookingGroupActions";
import { AdminBookingEditForm } from "@/components/admin/AdminBookingEditForm";
import { BookingNotificationsTable } from "@/components/admin/BookingNotificationsTable";

export const dynamic = "force-dynamic";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await prisma.booking.findUnique({
    where: { id },
    include: {
      object: { include: { objectType: { include: { category: true } } } },
      payment: true,
      notifications: { orderBy: { sentAt: "desc" } },
    },
  });
  if (!b) notFound();

  // Если бронь входит в групповой заказ — подгружаем заказ и связанные брони.
  const group = b.groupId
    ? await prisma.bookingGroup.findUnique({
        where: { id: b.groupId },
        include: {
          payment: true,
          bookings: {
            include: { object: { include: { objectType: { include: { category: true } } } } },
            orderBy: { startAt: "asc" },
          },
        },
      })
    : null;

  return (
    <div className="space-y-4">
      <Link href="/admin/bookings" className="text-sm text-muted-foreground hover:underline">
        ← Все брони
      </Link>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Бронь {b.publicCode}</h1>
        {/* Для броней в составе заказа статус показываем только у заказа
            (оплата всё-или-ничего на уровне группы). */}
        {!group && <StatusBadge status={b.status} />}
        <div className="ml-auto">
          <AdminBookingEditForm
            id={b.id}
            initial={{
              guestName: b.guestName,
              guestEmail: b.guestEmail,
              guestPhone: b.guestPhone,
              guestComment: b.guestComment,
              guestsCount: b.guestsCount,
            }}
            maxCapacity={b.object.objectType.maxCapacity}
          />
        </div>
      </div>

      {group && (
        <Card className="border-primary/40">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle>Заказ {group.publicCode}</CardTitle>
              <StatusBadge status={group.status} />
              <span className="text-sm text-muted-foreground">
                ({group.bookings.length} объ.)
              </span>
            </div>
            <GroupDeleteButton id={group.id} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1.5">
              {group.bookings.map((gb) => (
                <Link
                  key={gb.id}
                  href={`/admin/bookings/${gb.id}`}
                  className={`flex items-center justify-between gap-2 rounded-md border p-2 hover:bg-slate-50 ${
                    gb.id === b.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <span className="font-medium">{gb.object.name}</span>{" "}
                    <span className="text-muted-foreground">
                      ({gb.object.objectType.category.name})
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatLocal(gb.startAt)} — {formatLocal(gb.endAt)} · {gb.guestsCount} гост.
                    </span>
                  </span>
                  <span className="text-right shrink-0">
                    {formatRub(gb.totalPrice.toString())}
                  </span>
                </Link>
              ))}
            </div>

            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Итого по заказу</span>
                <span className="font-semibold">{formatRub(group.totalPrice.toString())}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Предоплата</span>
                <span>{formatRub(group.prepaymentAmount.toString())}</span>
              </div>
              {group.payment && (
                <div className="text-muted-foreground pt-1">
                  Платёж: {group.payment.provider} · {group.payment.status} ·{" "}
                  {formatRub(group.payment.amount.toString())}
                </div>
              )}
            </div>

            {group.status !== "CANCELLED" && (
              <div className="flex flex-wrap gap-2">
                {group.payment?.status === "SUCCEEDED" ? (
                  <GroupRefundButton id={group.id} amount={formatRub(group.payment.amount.toString())} />
                ) : (
                  <GroupCancelButton id={group.id} />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Гость</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">ФИО:</span> {b.guestName}</div>
          <div><span className="text-muted-foreground">Email:</span> {b.guestEmail}</div>
          <div><span className="text-muted-foreground">Телефон:</span> {b.guestPhone}</div>
          <div><span className="text-muted-foreground">Гостей:</span> {b.guestsCount}</div>
          {b.guestComment && (
            <div className="md:col-span-2">
              <span className="text-muted-foreground">Комментарий:</span> {b.guestComment}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Объект и время</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Объект:</span> {b.object.name}</div>
          <div><span className="text-muted-foreground">Категория:</span> {b.object.objectType.category.name}</div>
          <div><span className="text-muted-foreground">Начало:</span> {formatLocal(b.startAt)}</div>
          <div><span className="text-muted-foreground">Конец:</span> {formatLocal(b.endAt)}</div>
          <div><span className="text-muted-foreground">Заблокирован до:</span> {formatLocal(b.blockedUntil)}</div>
          <div><span className="text-muted-foreground">Создана:</span> {formatLocal(b.createdAt)}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Платёж</CardTitle>
          {b.payment?.status === "SUCCEEDED" && (
            <BookingRefundButton
              id={b.id}
              amount={formatRub(b.payment.amount.toString())}
            />
          )}
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Базовая стоимость: {formatRub(b.basePrice.toString())}</div>
          <div>Допгости: {b.extraGuests} ({formatRub(b.extraGuestsCost.toString())})</div>
          <div className="font-semibold pt-1">Итого: {formatRub(b.totalPrice.toString())}</div>
          {Number(b.prepaymentAmount) > 0 && Number(b.prepaymentAmount) < Number(b.totalPrice) && (
            <>
              <div className="pt-1">
                Предоплата
                {b.paymentType === "FIXED" ? " (фикс. сумма)" : ` (${b.paymentPercent}%)`}
                : {formatRub(b.prepaymentAmount.toString())}
              </div>
              <div>
                Остаток к оплате на месте:{" "}
                {formatRub(
                  (Number(b.totalPrice) - Number(b.prepaymentAmount)).toFixed(2),
                )}
              </div>
            </>
          )}
          {b.payment && (
            <div className="pt-2 text-muted-foreground">
              Провайдер: {b.payment.provider} · {b.payment.status} · сумма платежа:{" "}
              {formatRub(b.payment.amount.toString())}
              {b.payment.externalId && <> · ID {b.payment.externalId}</>}
            </div>
          )}
          {group && (
            <div className="pt-2 text-muted-foreground">
              Оплата и возврат — на уровне заказа{" "}
              <span className="font-mono">{group.publicCode}</span> (см. блок «Заказ» выше).
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Действия</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {b.status !== "COMPLETED" && (
            <BookingActions id={b.id} status={b.status} />
          )}
          <div className="ml-auto">
            <BookingDeleteButton id={b.id} />
          </div>
        </CardContent>
      </Card>

      {b.notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Уведомления{" "}
              <span className="text-sm font-normal text-muted-foreground">
                ({b.notifications.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BookingNotificationsTable notifications={b.notifications} />
          </CardContent>
        </Card>
      )}
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
