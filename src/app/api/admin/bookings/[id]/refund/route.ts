import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { refundPayment } from "@/lib/tinkoff";
import { sendStatusChangeNotifications } from "@/lib/notifications/email";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const existing = await prisma.booking.findUnique({
      where: { id },
      select: { publicCode: true },
    });
    const result = await refundPayment(id);
    sendStatusChangeNotifications(id, "CANCELLED").catch((e) =>
      console.error("[notify refund]", e),
    );
    await recordAudit({
      actor: actorFromSession(session),
      action: "REFUND",
      entity: "BOOKING",
      entityId: id,
      summary: `Оформил возврат по брони ${existing?.publicCode ?? id}`,
      ip: getClientIp(req.headers),
    });
    return ok(result);
  } catch (e) {
    return handleError(e, { req, action: "Возврат по брони" });
  }
}
