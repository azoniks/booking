import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLocal } from "@/lib/time";
import { formatRub } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { BookingActions } from "@/components/admin/BookingActions";

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

  return (
    <div className="space-y-4">
      <Link href="/admin/bookings" className="text-sm text-muted-foreground hover:underline">
        ← Все брони
      </Link>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Бронь {b.publicCode}</h1>
        <Badge variant={
          b.status === "PAID" ? "success" :
          b.status === "PENDING" ? "warning" :
          b.status === "CANCELLED" ? "destructive" : "secondary"
        }>{b.status}</Badge>
      </div>

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
        <CardHeader><CardTitle>Платёж</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Базовая стоимость: {formatRub(b.basePrice.toString())}</div>
          <div>Допгости: {b.extraGuests} ({formatRub(b.extraGuestsCost.toString())})</div>
          <div className="font-semibold pt-1">Итого: {formatRub(b.totalPrice.toString())}</div>
          {b.paymentPercent < 100 && (
            <>
              <div className="pt-1">
                Предоплата ({b.paymentPercent}%): {formatRub(b.prepaymentAmount.toString())}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Действия</CardTitle></CardHeader>
        <CardContent>
          <BookingActions id={b.id} status={b.status} />
        </CardContent>
      </Card>

      {b.notifications.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Уведомления</CardTitle></CardHeader>
          <CardContent>
            <ul className="text-sm space-y-1">
              {b.notifications.map((n) => (
                <li key={n.id} className="flex justify-between gap-2">
                  <span>
                    {n.channel} → {n.recipient} ({n.kind})
                  </span>
                  <span className="text-muted-foreground">{formatLocal(n.sentAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
