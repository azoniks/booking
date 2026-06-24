import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { refundGroupPayment } from "@/lib/tinkoff";
import { sendStatusChangeNotifications } from "@/lib/notifications/email";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

// Полный возврат по групповому заказу + отмена всех его броней.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const group = await prisma.bookingGroup.findUnique({
      where: { id },
      select: { publicCode: true },
    });
    const result = await refundGroupPayment(id);
    // Уведомим клиента по первой брони заказа об отмене.
    const first = await prisma.booking.findFirst({
      where: { groupId: id },
      select: { id: true },
    });
    if (first) {
      sendStatusChangeNotifications(first.id, "CANCELLED").catch((e) =>
        console.error("[notify group refund]", e),
      );
    }
    await recordAudit({
      actor: actorFromSession(session),
      action: "REFUND",
      entity: "BOOKING_GROUP",
      entityId: id,
      summary: `Оформил возврат по заказу ${group?.publicCode ?? id}`,
      ip: getClientIp(req.headers),
    });
    return ok(result);
  } catch (e) {
    return handleError(e, { req, action: "Возврат по заказу" });
  }
}
