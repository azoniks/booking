import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, RefreshCcw, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { sendPaymentRetryEmail } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";

type Reason = "expired" | "not_found" | "not_pending" | "init_failed" | undefined;

const reasonMessage: Record<Exclude<Reason, undefined>, string> = {
  expired: "Срок оплаты истёк, бронь будет отменена в ближайшее время.",
  not_found: "Бронь с таким кодом не найдена.",
  not_pending: "Эта бронь уже не ожидает оплаты.",
  init_failed:
    "Не удалось сформировать новый платёж. Попробуйте ещё раз через минуту или свяжитесь с нами.",
};

export default async function FailedPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; reason?: Reason }>;
}) {
  const { code, reason } = await searchParams;

  const booking = code
    ? await prisma.booking.findUnique({
        where: { publicCode: code },
        select: {
          id: true,
          publicCode: true,
          status: true,
          createdAt: true,
        },
      })
    : null;

  const elapsedMin = booking
    ? (Date.now() - booking.createdAt.getTime()) / 60_000
    : 0;
  const remainingMin = booking
    ? Math.max(0, Math.ceil(env.PAYMENT_TIMEOUT_MINUTES - elapsedMin))
    : 0;
  const canRetry =
    booking != null && booking.status === "PENDING" && remainingMin > 0;

  // Письмо о повторной оплате — один раз на бронь (дедуп внутри функции).
  if (canRetry) {
    sendPaymentRetryEmail(booking.id).catch((e) =>
      console.error("[booking/failed] retry email:", e),
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <Card className="max-w-lg w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <XCircle className="w-8 h-8 text-destructive" />
            <CardTitle>Оплата не прошла</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason && reasonMessage[reason] && (
            <p className="text-sm text-destructive">{reasonMessage[reason]}</p>
          )}

          {booking ? (
            <>
              <p className="text-sm text-muted-foreground">
                Бронь{" "}
                <span className="font-mono text-foreground">
                  {booking.publicCode}
                </span>{" "}
                не подтверждена.
              </p>

              {canRetry && (
                <>
                  <div className="flex items-start gap-2 text-sm text-muted-foreground rounded-md border bg-amber-50/60 border-amber-200 p-3">
                    <Clock className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                    <span>
                      Бронь будет автоматически отменена через{" "}
                      <b>~{remainingMin} мин.</b>, если оплата не поступит.
                      Ссылка для повторной оплаты также отправлена вам на почту.
                    </span>
                  </div>
                  <Button asChild className="w-full">
                    <Link href={`/booking/retry?code=${booking.publicCode}`}>
                      <RefreshCcw className="w-4 h-4 mr-2" />
                      Попробовать ещё раз
                    </Link>
                  </Button>
                </>
              )}

              {!canRetry && booking.status === "PENDING" && (
                <p className="text-sm text-muted-foreground">
                  Срок оплаты истёк. Создайте новую бронь, если хотите
                  попробовать снова.
                </p>
              )}

              {booking.status === "CANCELLED" && (
                <p className="text-sm text-muted-foreground">
                  Бронь была отменена.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {code ? (
                <>
                  Код: <span className="font-mono">{code}</span>.
                </>
              ) : null}{" "}
              Попробуйте ещё раз.
            </p>
          )}

          <Button asChild variant="outline" className="w-full">
            <Link href="/">На главную</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
