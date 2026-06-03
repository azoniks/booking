import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { cancelGroup } from "@/lib/tinkoff";
import { sendStatusChangeNotifications } from "@/lib/notifications/email";

// Отмена группового заказа без возврата (для неоплаченных). Для оплаченных
// используйте /refund, чтобы вернуть деньги.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
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
    const first = await prisma.booking.findFirst({
      where: { groupId: id },
      select: { id: true },
    });
    if (first) {
      sendStatusChangeNotifications(first.id, "CANCELLED").catch((e) =>
        console.error("[notify group cancel]", e),
      );
    }
    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}
