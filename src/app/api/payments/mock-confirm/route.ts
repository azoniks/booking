import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api-utils";
import { applyMockPayment, mockSign } from "@/lib/tinkoff";
import { sendPaidNotifications } from "@/lib/notifications/email";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (!env.TINKOFF_TEST_MODE) return fail("Только в test mode", 400);
  const body = (await req.json()) as { bookingId?: string; sig?: string; succeeded?: boolean };
  const bookingId = String(body.bookingId || "");
  const sig = String(body.sig || "");
  if (!bookingId || sig !== mockSign(bookingId)) return fail("BAD_SIG", 403);
  const succeeded = body.succeeded !== false;
  await applyMockPayment(bookingId, succeeded);
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, select: { publicCode: true } });
  if (succeeded) {
    sendPaidNotifications(bookingId).catch((e) => console.error("[notify]", e));
  }
  return ok({ ok: true, publicCode: b?.publicCode });
}
