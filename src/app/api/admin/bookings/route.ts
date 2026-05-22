import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { Prisma } from "@prisma/client";
import { adminBookingSchema } from "@/lib/validators";
import { createBooking } from "@/lib/booking-service";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const objectId = url.searchParams.get("objectId");
  const from = url.searchParams.get("from"); // YYYY-MM-DD
  const to = url.searchParams.get("to");

  const where: Prisma.BookingWhereInput = {};
  if (status) where.status = status as Prisma.EnumBookingStatusFilter["equals"];
  if (objectId) where.objectId = objectId;
  if (from) where.startAt = { ...(where.startAt as object), gte: new Date(from + "T00:00:00Z") };
  if (to) where.startAt = { ...(where.startAt as object), lte: new Date(to + "T23:59:59Z") };

  const items = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      object: { include: { objectType: { include: { category: true } } } },
      payment: true,
    },
  });
  return ok(items);
}

// Ручное создание брони администратором: использует тот же createBooking
// (проверка пересечений, расчёт цены), но без Tinkoff и сразу с нужным статусом.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const data = adminBookingSchema.parse(await req.json());
    const booking = await createBooking({
      objectId: data.objectId,
      checkInDate: data.checkInDate,
      checkOutDate: data.checkOutDate,
      startAt: data.startAt,
      endAt: data.endAt,
      slotId: data.slotId,
      slotDate: data.slotDate,
      guestsCount: data.guestsCount,
      guestName: data.guestName,
      guestEmail: data.guestEmail || "",
      guestPhone: data.guestPhone,
      guestPhone2: data.guestPhone2,
      guestComment: data.guestComment,
    });
    if (data.markAsPaid) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status: "PAID", paidAt: new Date() },
      });
    }
    return ok({ id: booking.id, publicCode: booking.publicCode }, 201);
  } catch (e) {
    return handleError(e);
  }
}
