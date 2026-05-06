import { prisma } from "@/lib/db";
import { ok } from "@/lib/api-utils";

/**
 * Публичная инфа о настроенных мессенджер-каналах для клиентских уведомлений.
 * Используется success-страницей для построения deep-link на бота.
 */
export async function GET() {
  const items = await prisma.settings.findMany({
    where: {
      key: {
        in: [
          "telegramClientEnabled",
          "telegramBotUsername",
          "maxClientEnabled",
          "maxBotUsername",
        ],
      },
    },
  });
  const map: Record<string, string> = {};
  for (const s of items) {
    if (s.value !== null && s.value !== undefined) {
      map[s.key] = String(s.value);
    }
  }
  const tg = {
    enabled: map.telegramClientEnabled === "true" && !!map.telegramBotUsername,
    botUsername: map.telegramBotUsername || "",
  };
  const max = {
    enabled: map.maxClientEnabled === "true" && !!map.maxBotUsername,
    botUsername: map.maxBotUsername || "",
  };
  return ok({ telegram: tg, max });
}
