import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Получить (или сгенерировать) секрет для входящих webhook-ов мессенджера.
 * Секрет используется как сегмент в URL: /api/webhooks/<channel>/<secret>.
 */
export async function getOrCreateWebhookSecret(channel: "telegram" | "max"): Promise<string> {
  const key = channel === "telegram" ? "telegramWebhookSecret" : "maxWebhookSecret";
  const existing = await prisma.settings.findUnique({ where: { key } });
  if (existing && typeof existing.value === "string" && existing.value.trim()) {
    return existing.value;
  }
  const secret = randomBytes(24).toString("hex");
  await prisma.settings.upsert({
    where: { key },
    create: { key, value: secret },
    update: { value: secret },
  });
  return secret;
}

export async function readWebhookSecret(channel: "telegram" | "max"): Promise<string | null> {
  const key = channel === "telegram" ? "telegramWebhookSecret" : "maxWebhookSecret";
  const s = await prisma.settings.findUnique({ where: { key } });
  if (!s || typeof s.value !== "string") return null;
  return s.value || null;
}
