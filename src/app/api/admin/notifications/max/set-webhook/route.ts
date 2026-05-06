import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { getMaxConfig } from "@/lib/notifications/max";
import { getOrCreateWebhookSecret } from "@/lib/notifications/webhook-secret";
import { env } from "@/lib/env";

/**
 * MAX Bot API: подписка на webhook через POST /subscriptions
 * https://dev.max.ru/docs-api/methods/subscriptions
 */
export async function POST() {
  if (!(await requireAdmin())) return unauth();
  try {
    const cfg = await getMaxConfig();
    if (!cfg.token) return fail("Сначала задайте Bot Token", 400);
    const secret = await getOrCreateWebhookSecret("max");
    const url = `${env.APP_URL}/api/webhooks/max/${secret}`;
    const res = await fetch(
      `${cfg.apiUrl}/subscriptions?access_token=${encodeURIComponent(cfg.token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          update_types: ["message_created", "bot_started"],
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return fail(`MAX отклонил webhook: ${res.status} ${text}`, 400);
    }
    return ok({ webhookUrl: url });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE() {
  if (!(await requireAdmin())) return unauth();
  try {
    const cfg = await getMaxConfig();
    if (!cfg.token) return fail("Bot Token не задан", 400);
    const secret = await getOrCreateWebhookSecret("max");
    const url = `${env.APP_URL}/api/webhooks/max/${secret}`;
    const res = await fetch(
      `${cfg.apiUrl}/subscriptions?access_token=${encodeURIComponent(cfg.token)}&url=${encodeURIComponent(url)}`,
      { method: "DELETE" },
    );
    if (!res.ok) return fail(`MAX отклонил: ${res.status}`, 400);
    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
