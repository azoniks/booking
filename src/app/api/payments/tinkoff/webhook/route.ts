import { NextRequest } from "next/server";
import { verifyTinkoffWebhook, applyPaymentResult } from "@/lib/tinkoff";
import {
  sendPaidNotifications,
  sendPaidGroupNotifications,
} from "@/lib/notifications/email";

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as Record<string, unknown>;
    if (!(await verifyTinkoffWebhook(payload))) {
      return new Response("BAD_TOKEN", { status: 400 });
    }
    const externalId = String(payload.PaymentId || "");
    const status = String(payload.Status || "");
    const succeeded = status === "CONFIRMED" || status === "AUTHORIZED";
    if (externalId) {
      const res = await applyPaymentResult({ externalId, succeeded, rawPayload: payload });
      // Уведомления — только при ПЕРВОМ переходе платежа в успех (Tinkoff может
      // прислать несколько вебхуков: AUTHORIZED, CONFIRMED, ретраи).
      if (res?.succeeded && res.firstSettle) {
        if (res.groupId) {
          // Групповой заказ — агрегированное уведомление.
          sendPaidGroupNotifications(res.groupId).catch((e) => console.error("[notify group]", e));
        } else if (res.bookingId) {
          // Одиночная бронь — как в mock-обработчике.
          sendPaidNotifications(res.bookingId).catch((e) => console.error("[notify]", e));
        }
      }
    }
    return new Response("OK");
  } catch (e) {
    console.error("[tinkoff webhook]", e);
    return new Response("ERR", { status: 500 });
  }
}
