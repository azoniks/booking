import { NextRequest } from "next/server";
import { verifyTinkoffWebhook, applyPaymentResult } from "@/lib/tinkoff";

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
      await applyPaymentResult({ externalId, succeeded, rawPayload: payload });
    }
    return new Response("OK");
  } catch (e) {
    console.error("[tinkoff webhook]", e);
    return new Response("ERR", { status: 500 });
  }
}
