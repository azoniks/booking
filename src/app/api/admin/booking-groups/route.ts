import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { adminBookingGroupSchema, paymentStateToStatus } from "@/lib/validators";
import { createBookingGroup } from "@/lib/booking-service";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

// Ручное создание группового заказа администратором: тот же createBookingGroup
// (атомарная проверка пересечений + расчёт), без Tinkoff. markAsPaid сразу
// помечает заказ и все его брони оплаченными.
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return unauth();
  const attempt: { req: NextRequest; action: string; context?: unknown } = {
    req,
    action: "Создание заказа (админ)",
  };
  try {
    const data = adminBookingGroupSchema.parse(await req.json());
    attempt.context = {
      guestName: data.guestName,
      guestPhone: data.guestPhone,
      objectIds: data.items.map((i) => i.objectId),
    };
    const group = await createBookingGroup(data.items, {
      guestName: data.guestName,
      guestEmail: data.guestEmail || "",
      guestPhone: data.guestPhone,
      guestComment: data.guestComment,
    });

    // Стартовый статус оплаты заказа и всех его броней (none/prepaid/paid).
    if (data.paymentState !== "none") {
      const { status, paidAt } = paymentStateToStatus(data.paymentState);
      await prisma.$transaction([
        prisma.bookingGroup.update({
          where: { id: group.id },
          data: { status, paidAt },
        }),
        prisma.booking.updateMany({
          where: { groupId: group.id },
          data: { status, paidAt },
        }),
      ]);
    }

    await recordAudit({
      actor: actorFromSession(session),
      action: "CREATE",
      entity: "BOOKING_GROUP",
      entityId: group.id,
      summary: `Создал заказ ${group.publicCode} (${data.guestName}, объектов: ${data.items.length})`,
      meta: { items: data.items.length, paymentState: data.paymentState },
      ip: getClientIp(req.headers),
    });
    return ok({ id: group.id, publicCode: group.publicCode }, 201);
  } catch (e) {
    return handleError(e, attempt);
  }
}
