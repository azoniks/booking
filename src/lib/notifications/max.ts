import { prisma } from "@/lib/db";

/**
 * Интеграция с мессенджером MAX (бывший Tamtam, VK).
 * Bot API: https://dev.max.ru/ (наследник https://dev.tamtam.chat/).
 *
 * Отправка сообщения:
 *   POST {apiUrl}/messages?access_token=<TOKEN>&chat_id=<CHAT_ID>
 *   body: { "text": "..." }
 */
const DEFAULT_API_URL = "https://botapi.max.ru";

export interface MaxConfig {
  enabled: boolean;
  token: string;
  chatId: string;
  apiUrl: string;
}

async function loadSetting(key: string): Promise<string | null> {
  const s = await prisma.settings.findUnique({ where: { key } });
  if (!s || s.value === null || s.value === undefined) return null;
  return String(s.value);
}

export async function getMaxConfig(): Promise<MaxConfig> {
  const [enabledRaw, token, chatId, apiUrl] = await Promise.all([
    loadSetting("maxEnabled"),
    loadSetting("maxBotToken"),
    loadSetting("maxChatId"),
    loadSetting("maxApiUrl"),
  ]);
  const t = (token || "").trim();
  const c = (chatId || "").trim();
  const explicitDisabled = enabledRaw === "false";
  return {
    enabled: !explicitDisabled && !!(t && c),
    token: t,
    chatId: c,
    apiUrl: (apiUrl && apiUrl.trim()) || DEFAULT_API_URL,
  };
}

export async function sendMax(text: string, bookingId?: string, kind = "admin") {
  const cfg = await getMaxConfig();
  if (!cfg.enabled) return;
  try {
    const url = `${cfg.apiUrl}/messages?access_token=${encodeURIComponent(
      cfg.token,
    )}&chat_id=${encodeURIComponent(cfg.chatId)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      throw new Error(`MAX API ${res.status}: ${await res.text()}`);
    }
    await prisma.notificationLog.create({
      data: {
        bookingId,
        channel: "MAX",
        kind,
        recipient: cfg.chatId,
        status: "sent",
      },
    });
  } catch (e) {
    await prisma.notificationLog.create({
      data: {
        bookingId,
        channel: "MAX",
        kind,
        recipient: cfg.chatId,
        status: "failed",
        error: String(e).slice(0, 500),
      },
    });
  }
}
