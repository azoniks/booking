import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatLocal } from "@/lib/time";
import { CheckCircle2 } from "lucide-react";
import { MessengerOptIn } from "@/components/client/MessengerOptIn";
import { SiteHeader } from "@/components/client/SiteHeader";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; group?: string }>;
}) {
  const { code, group } = await searchParams;

  const g = group
    ? await prisma.bookingGroup.findUnique({
        where: { publicCode: group },
        include: {
          bookings: {
            include: { object: { include: { objectType: { include: { category: true } } } } },
            orderBy: { startAt: "asc" },
          },
        },
      })
    : null;

  if (g) {
    const total = Number(g.totalPrice);
    const prepay = Number(g.prepaymentAmount);
    const remaining = Math.max(0, total - prepay);
    const fmt = (n: number) => n.toLocaleString("ru-RU");
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <SiteHeader />
        <main className="flex-1 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              <CardTitle>Заказ подтверждён</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>Код заказа: <span className="font-mono font-bold">{g.publicCode}</span></div>
            <div className="space-y-2">
              {g.bookings.map((b) => (
                <div key={b.id} className="rounded-md border p-2.5">
                  <div className="font-medium">
                    {b.object.name}{" "}
                    <span className="text-muted-foreground font-normal">
                      ({b.object.objectType.category.name})
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {formatLocal(b.startAt)} — {formatLocal(b.endAt)} · {b.guestsCount} гост. · {fmt(Number(b.totalPrice))} ₽
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">{b.publicCode}</div>
                </div>
              ))}
            </div>
            <div className="rounded-md border bg-muted/30 p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Полная стоимость</span>
                <span>{fmt(total)} ₽</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Оплачено онлайн</span>
                <span className="font-medium text-emerald-700">{fmt(prepay)} ₽</span>
              </div>
              {remaining > 0 && (
                <div className="flex justify-between border-t pt-1">
                  <span className="font-medium">Остаток при заселении</span>
                  <span className="font-semibold">{fmt(remaining)} ₽</span>
                </div>
              )}
            </div>
            <div className="text-muted-foreground pt-1">
              Подтверждение отправлено на {g.guestEmail}.
            </div>
            <Button asChild className="w-full">
              <Link href="/">На главную</Link>
            </Button>
          </CardContent>
        </Card>
        </main>
      </div>
    );
  }

  const b = code
    ? await prisma.booking.findUnique({
        where: { publicCode: code },
        include: { object: { include: { objectType: { include: { category: true } } } } },
      })
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            <CardTitle>Бронь подтверждена</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {b ? (
            (() => {
              const total = Number(b.totalPrice);
              const prepay = Number(b.prepaymentAmount);
              const remaining = Math.max(0, total - prepay);
              const split = remaining > 0 && prepay > 0 && prepay < total;
              const fmt = (n: number) => n.toLocaleString("ru-RU");
              const prepayLabel =
                b.paymentType === "FIXED"
                  ? "Оплачено онлайн (фикс. предоплата)"
                  : `Оплачено онлайн (предоплата ${b.paymentPercent}%)`;
              return (
                <div className="space-y-2 text-sm">
                  <div>Код брони: <span className="font-mono font-bold">{b.publicCode}</span></div>
                  <div>Объект: {b.object.name} ({b.object.objectType.category.name})</div>
                  <div>Время: {formatLocal(b.startAt)} — {formatLocal(b.endAt)}</div>
                  <div>Гостей: {b.guestsCount}</div>
                  {split ? (
                    <div className="rounded-md border bg-muted/30 p-3 mt-1 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Полная стоимость</span>
                        <span>{fmt(total)} ₽</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{prepayLabel}</span>
                        <span className="font-medium text-emerald-700">{fmt(prepay)} ₽</span>
                      </div>
                      <div className="flex justify-between border-t pt-1">
                        <span className="font-medium">Остаток при заселении</span>
                        <span className="font-semibold">{fmt(remaining)} ₽</span>
                      </div>
                    </div>
                  ) : (
                    <div>Оплачено: <b>{fmt(prepay || total)} ₽</b></div>
                  )}
                  <div className="text-muted-foreground pt-2">
                    Подтверждение отправлено на {b.guestEmail}.
                  </div>
                </div>
              );
            })()
          ) : (
            <p>Спасибо! Подробности отправлены на email.</p>
          )}
          {b && <MessengerOptIn publicCode={b.publicCode} />}
          <Button asChild className="w-full">
            <Link href="/">На главную</Link>
          </Button>
        </CardContent>
      </Card>
      </main>
    </div>
  );
}
