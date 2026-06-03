import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-utils";
import {
  applyMockPayment,
  applyMockPaymentForGroup,
  mockSign,
  getTinkoffConfig,
} from "@/lib/tinkoff";
import { sendPaidNotifications, sendPaidGroupNotifications } from "@/lib/notifications/email";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  // Mock-режим определяется настройками в админке (Settings.tinkoffMode),
  // не env-переменной — иначе после переключения в UI этот endpoint падал в 400.
  const cfg = await getTinkoffConfig();
  if (cfg.mode !== "mock") return fail("Mock-режим выключен в настройках", 400);

  const body = (await req.json()) as {
    bookingId?: string;
    groupId?: string;
    sig?: string;
    succeeded?: boolean;
  };
  const sig = String(body.sig || "");
  const succeeded = body.succeeded !== false;

  // Групповой заказ
  if (body.groupId) {
    const groupId = String(body.groupId);
    if (sig !== mockSign(groupId)) return fail("BAD_SIG", 403);
    await applyMockPaymentForGroup(groupId, succeeded);
    const g = await prisma.bookingGroup.findUnique({
      where: { id: groupId },
      select: { publicCode: true },
    });
    if (succeeded) {
      sendPaidGroupNotifications(groupId).catch((e) => console.error("[notify group]", e));
    }
    return ok({ ok: true, groupCode: g?.publicCode });
  }

  // Одиночная бронь
  const bookingId = String(body.bookingId || "");
  if (!bookingId || sig !== mockSign(bookingId)) return fail("BAD_SIG", 403);
  await applyMockPayment(bookingId, succeeded);
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { publicCode: true } });
  if (succeeded) {
    sendPaidNotifications(bookingId).catch((e) => console.error("[notify]", e));
  }
  return ok({ ok: true, publicCode: b?.publicCode });
}
