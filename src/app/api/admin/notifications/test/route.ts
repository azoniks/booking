import { NextRequest } from "next/server";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { sendTelegram, getTelegramConfig } from "@/lib/notifications/telegram";
import { sendMax, getMaxConfig } from "@/lib/notifications/max";
import { sendTestEmail, getEmailConfig } from "@/lib/notifications/email";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const body = (await req.json()) as { channel?: string; to?: string };
    const text = `Тестовое сообщение из админки бронирования (${new Date().toLocaleString("ru-RU")})`;

    if (body.channel === "telegram") {
      const cfg = await getTelegramConfig();
      if (!cfg.enabled) return fail("Telegram не настроен или отключён", 400);
      await sendTelegram(text, undefined, "test");
      return ok({ sent: true, channel: "telegram", recipient: cfg.chatId });
    }
    if (body.channel === "max") {
      const cfg = await getMaxConfig();
      if (!cfg.enabled) return fail("MAX не настроен или отключён", 400);
      await sendMax(text, undefined, "test");
      return ok({ sent: true, channel: "max", recipient: cfg.chatId });
    }
    if (body.channel === "email") {
      const cfg = await getEmailConfig();
      if (!cfg.enabled) return fail("SMTP не настроен", 400);
      // адрес: либо явно передан, либо первый из adminNotifyEmails
      let to = body.to?.trim();
      if (!to) {
        const s = await prisma.settings.findUnique({ where: { key: "adminNotifyEmails" } });
        if (s && Array.isArray(s.value) && (s.value as string[]).length) {
          to = (s.value as string[])[0];
        }
      }
      if (!to) return fail("Укажите email получателя или адрес админа в настройках", 400);
      const info = await sendTestEmail(to);
      return ok({ sent: true, channel: "email", recipient: to, ...info });
    }
    return fail("Неизвестный channel (ожидается telegram, max или email)", 400);
  } catch (e) {
    return handleError(e);
  }
}
