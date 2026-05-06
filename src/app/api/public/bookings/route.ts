import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api-utils";
import { publicBookingSchema } from "@/lib/validators";
import { createBooking } from "@/lib/booking-service";
import { initPayment } from "@/lib/tinkoff";
import { sendNewBookingNotifications } from "@/lib/notifications/email";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const data = publicBookingSchema.parse(await req.json());
    const booking = await createBooking(data);

    // создаём платёж и получаем confirmationUrl
    const payment = await initPayment(booking.id);

    // уведомления (не блокируем успех брони если упадут)
    sendNewBookingNotifications(booking.id).catch((e) =>
      console.error("[notify] failed:", e),
    );

    return ok({
      bookingId: booking.id,
      publicCode: booking.publicCode,
      confirmationUrl: payment.confirmationUrl,
    });
  } catch (e) {
    return handleError(e);
  }
}

// получение брони по publicCode (для success страницы)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) return ok(null, 400);
    const b = await prisma.booking.findUnique({
      where: { publicCode: code },
      include: { object: { include: { objectType: { include: { category: true } } } } },
    });
    return ok(b);
  } catch (e) {
    return handleError(e);
  }
}
