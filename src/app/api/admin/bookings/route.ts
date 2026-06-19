import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { Prisma } from "@prisma/client";
import { adminBookingSchema, paymentStateToStatus } from "@/lib/validators";
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
      bookingDate: data.bookingDate,
      guestsCount: data.guestsCount,
      guestName: data.guestName,
      guestEmail: data.guestEmail || "",
      guestPhone: data.guestPhone,
      guestComment: data.guestComment,
    });
    // Стартовый статус оплаты по выбору администратора (none/prepaid/paid).
    if (data.paymentState !== "none") {
      const { status, paidAt } = paymentStateToStatus(data.paymentState);
      await prisma.booking.update({
        where: { id: booking.id },
        data: { status, paidAt },
      });
    }
    return ok({ id: booking.id, publicCode: booking.publicCode }, 201);
  } catch (e) {
    return handleError(e);
  }
}

// Массовое удаление по фильтру. Требует ?confirm=1 во избежание случайного запроса.
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const url = new URL(req.url);
    if (url.searchParams.get("confirm") !== "1") {
      return ok({ error: "confirm=1 required" }, 400);
    }
    const status = url.searchParams.get("status");
    const objectId = url.searchParams.get("objectId");
    const categoryId = url.searchParams.get("cat");

    const where: Prisma.BookingWhereInput = {};
    if (status) where.status = status as Prisma.EnumBookingStatusFilter["equals"];
    if (objectId) where.objectId = objectId;
    if (categoryId) where.object = { objectType: { categoryId } };

    const result = await prisma.booking.deleteMany({ where });
    return ok({ deleted: result.count });
  } catch (e) {
    return handleError(e);
  }
}
