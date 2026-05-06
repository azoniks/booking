import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { getTelegramConfig } from "@/lib/notifications/telegram";
import { getOrCreateWebhookSecret } from "@/lib/notifications/webhook-secret";
import { env } from "@/lib/env";

export async function POST() {
  if (!(await requireAdmin())) return unauth();
  try {
    const cfg = await getTelegramConfig();
    if (!cfg.token) return fail("Сначала задайте Bot Token", 400);
    const secret = await getOrCreateWebhookSecret("telegram");
    const url = `${env.APP_URL}/api/webhooks/telegram/${secret}`;
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, allowed_updates: ["message"] }),
    });
    const j = (await res.json()) as { ok?: boolean; description?: string };
    if (!j.ok) return fail(`Telegram отклонил webhook: ${j.description || res.status}`, 400);
    return ok({ webhookUrl: url });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE() {
  if (!(await requireAdmin())) return unauth();
  try {
    const cfg = await getTelegramConfig();
    if (!cfg.token) return fail("Bot Token не задан", 400);
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/deleteWebhook`, {
      method: "POST",
    });
    const j = (await res.json()) as { ok?: boolean; description?: string };
    if (!j.ok) return fail(j.description || "Ошибка", 400);
    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
