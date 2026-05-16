import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { initPayment } from "@/lib/tinkoff";
import { env } from "@/lib/env";

/**
 * GET /booking/retry?code=PUBLIC_CODE
 *
 * Перегенерирует Tinkoff-платёж для PENDING-брони и редиректит пользователя
 * на свежую форму оплаты. Используется со страницы /booking/failed и из писем.
 *
 * Tinkoff требует уникальный OrderId на каждый Init, поэтому initPayment()
 * автоматически добавляет суффикс к publicCode.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  const fallback = (reason?: string) => {
    const target = new URL(`${env.APP_URL}/booking/failed`);
    if (code) target.searchParams.set("code", code);
    if (reason) target.searchParams.set("reason", reason);
    return Response.redirect(target.toString(), 307);
  };

  if (!code) return Response.redirect(`${env.APP_URL}/`, 307);

  const booking = await prisma.booking.findUnique({
    where: { publicCode: code },
    select: { id: true, status: true, createdAt: true },
  });
  if (!booking) return fallback("not_found");

  if (booking.status === "PAID") {
    return Response.redirect(
      `${env.APP_URL}/booking/success?code=${code}`,
      307,
    );
  }
  if (booking.status !== "PENDING") return fallback("not_pending");

  const ageMin = (Date.now() - booking.createdAt.getTime()) / 60_000;
  if (ageMin > env.PAYMENT_TIMEOUT_MINUTES) return fallback("expired");

  try {
    const payment = await initPayment(booking.id);
    return Response.redirect(payment.confirmationUrl, 307);
  } catch (e) {
    console.error("[booking/retry] initPayment failed:", e);
    return fallback("init_failed");
  }
}
