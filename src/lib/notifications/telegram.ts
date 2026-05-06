import { env } from "@/lib/env";
import { prisma } from "@/lib/db";

export interface TelegramConfig {
  enabled: boolean;
  token: string;
  chatId: string;
}

async function loadSetting(key: string): Promise<string | null> {
  const s = await prisma.settings.findUnique({ where: { key } });
  if (!s || s.value === null || s.value === undefined) return null;
  return String(s.value);
}

export async function getTelegramConfig(): Promise<TelegramConfig> {
  const [enabledRaw, token, chatId] = await Promise.all([
    loadSetting("telegramEnabled"),
    loadSetting("telegramBotToken"),
    loadSetting("telegramChatId"),
  ]);
  const dbToken = (token || "").trim();
  const dbChatId = (chatId || "").trim();
  // По умолчанию включено если есть креды; явный флаг enabled может выключить.
  const explicitDisabled = enabledRaw === "false";
  const t = dbToken || env.TELEGRAM_BOT_TOKEN || "";
  const c = dbChatId || env.TELEGRAM_ADMIN_CHAT_ID || "";
  return {
    enabled: !explicitDisabled && !!(t && c),
    token: t,
    chatId: c,
  };
}

export async function sendTelegram(text: string, bookingId?: string, kind = "admin") {
  const cfg = await getTelegramConfig();
  if (!cfg.enabled) return;
  try {
    const url = `https://api.telegram.org/bot${cfg.token}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      throw new Error(`Telegram API ${res.status}: ${await res.text()}`);
    }
    await prisma.notificationLog.create({
      data: {
        bookingId,
        channel: "TELEGRAM",
        kind,
        recipient: cfg.chatId,
        status: "sent",
      },
    });
  } catch (e) {
    await prisma.notificationLog.create({
      data: {
        bookingId,
        channel: "TELEGRAM",
        kind,
        recipient: cfg.chatId,
        status: "failed",
        error: String(e).slice(0, 500),
      },
    });
  }
}
