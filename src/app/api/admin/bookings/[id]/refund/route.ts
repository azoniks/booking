import { NextRequest } from "next/server";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { refundPayment } from "@/lib/tinkoff";
import { sendStatusChangeNotifications } from "@/lib/notifications/email";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const result = await refundPayment(id);
    sendStatusChangeNotifications(id, "CANCELLED").catch((e) =>
      console.error("[notify refund]", e),
    );
    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
