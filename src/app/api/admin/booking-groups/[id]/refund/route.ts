import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { refundGroupPayment } from "@/lib/tinkoff";
import { sendStatusChangeNotifications } from "@/lib/notifications/email";

// Полный возврат по групповому заказу + отмена всех его броней.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
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
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
