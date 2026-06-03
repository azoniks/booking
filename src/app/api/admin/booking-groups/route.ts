import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { adminBookingGroupSchema } from "@/lib/validators";
import { createBookingGroup } from "@/lib/booking-service";

// Ручное создание группового заказа администратором: тот же createBookingGroup
// (атомарная проверка пересечений + расчёт), без Tinkoff. markAsPaid сразу
// помечает заказ и все его брони оплаченными.
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const data = adminBookingGroupSchema.parse(await req.json());
    const group = await createBookingGroup(data.items, {
      guestName: data.guestName,
      guestEmail: data.guestEmail || "",
      guestPhone: data.guestPhone,
      guestComment: data.guestComment,
    });

    if (data.markAsPaid) {
      const now = new Date();
      await prisma.$transaction([
        prisma.bookingGroup.update({
          where: { id: group.id },
          data: { status: "PAID", paidAt: now },
        }),
        prisma.booking.updateMany({
          where: { groupId: group.id },
          data: { status: "PAID", paidAt: now },
        }),
      ]);
    }

    return ok({ id: group.id, publicCode: group.publicCode }, 201);
  } catch (e) {
    return handleError(e);
  }
}
