import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatLocal } from "@/lib/time";
import { CheckCircle2 } from "lucide-react";
import { MessengerOptIn } from "@/components/client/MessengerOptIn";

export const dynamic = "force-dynamic";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const b = code
    ? await prisma.booking.findUnique({
        where: { publicCode: code },
        include: { object: { include: { objectType: { include: { category: true } } } } },
      })
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
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
              const split = b.paymentPercent < 100 && remaining > 0;
              const fmt = (n: number) => n.toLocaleString("ru-RU");
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
                        <span className="text-muted-foreground">
                          Оплачено онлайн (предоплата {b.paymentPercent}%)
                        </span>
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
    </div>
  );
}
