import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { cancelGroup } from "@/lib/tinkoff";
import { sendStatusChangeNotifications } from "@/lib/notifications/email";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

// Отмена группового заказа без возврата (для неоплаченных). Для оплаченных
// используйте /refund, чтобы вернуть деньги.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const payment = await prisma.payment.findUnique({ where: { groupId: id } });
    if (payment?.status === "SUCCEEDED") {
      return ok(
        { error: "Заказ оплачен — используйте возврат средств" },
        400,
      );
    }
    await cancelGroup(id);
    const group = await prisma.bookingGroup.findUnique({
      where: { id },
      select: { publicCode: true },
    });
    const first = await prisma.booking.findFirst({
      where: { groupId: id },
      select: { id: true },
    });
    if (first) {
      sendStatusChangeNotifications(first.id, "CANCELLED").catch((e) =>
        console.error("[notify group cancel]", e),
      );
    }
    await recordAudit({
      actor: actorFromSession(session),
      action: "CANCEL",
      entity: "BOOKING_GROUP",
      entityId: id,
      summary: `Отменил заказ ${group?.publicCode ?? id} (без возврата)`,
      ip: getClientIp(req.headers),
    });
    return ok({ id });
  } catch (e) {
    return handleError(e, { req, action: "Отмена заказа (без возврата)" });
  }
}
