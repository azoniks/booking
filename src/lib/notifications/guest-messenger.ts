import { prisma } from "@/lib/db";
import { getTelegramConfig } from "./telegram";
import { getMaxConfig } from "./max";

/**
 * Привязывает chat_id клиента к броне по publicCode.
 * Возвращает бронь, если найдена и привязка прошла, иначе null.
 */
export async function linkGuestChat(args: {
  channel: "telegram" | "max";
  publicCode: string;
  chatId: string;
}) {
  const code = args.publicCode.trim().toUpperCase();
  const booking = await prisma.booking.findUnique({ where: { publicCode: code } });
  if (!booking) return null;

  await prisma.booking.update({
    where: { id: booking.id },
    data: args.channel === "telegram"
      ? { telegramChatId: args.chatId }
      : { maxChatId: args.chatId },
  });
  return booking;
}

async function clientEnabled(channel: "telegram" | "max"): Promise<boolean> {
  const key = channel === "telegram" ? "telegramClientEnabled" : "maxClientEnabled";
  const s = await prisma.settings.findUnique({ where: { key } });
  if (!s || s.value === null || s.value === undefined) return false;
  return String(s.value) === "true";
}

/** Отправка клиенту через Telegram (если он подписался). */
export async function sendTelegramToGuest(bookingId: string, text: string, kind = "guest") {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b || !b.telegramChatId) return;
  if (!(await clientEnabled("telegram"))) return;
  const cfg = await getTelegramConfig();
  if (!cfg.token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: b.telegramChatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
    await prisma.notificationLog.create({
      data: { bookingId, channel: "TELEGRAM", kind, recipient: b.telegramChatId, status: "sent" },
    });
  } catch (e) {
    await prisma.notificationLog.create({
      data: {
        bookingId,
        channel: "TELEGRAM",
        kind,
        recipient: b.telegramChatId,
        status: "failed",
        error: String(e).slice(0, 500),
      },
    });
  }
}

/** Отправка клиенту через MAX (если он подписался). */
export async function sendMaxToGuest(bookingId: string, text: string, kind = "guest") {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b || !b.maxChatId) return;
  if (!(await clientEnabled("max"))) return;
  const cfg = await getMaxConfig();
  if (!cfg.token) return;
  try {
    const url = `${cfg.apiUrl}/messages?access_token=${encodeURIComponent(
      cfg.token,
    )}&chat_id=${encodeURIComponent(b.maxChatId)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`MAX ${res.status}: ${await res.text()}`);
    await prisma.notificationLog.create({
      data: { bookingId, channel: "MAX", kind, recipient: b.maxChatId, status: "sent" },
    });
  } catch (e) {
    await prisma.notificationLog.create({
      data: {
        bookingId,
        channel: "MAX",
        kind,
        recipient: b.maxChatId,
        status: "failed",
        error: String(e).slice(0, 500),
      },
    });
  }
}

/** Все включенные клиентские каналы для брони. */
export async function sendToGuestAll(bookingId: string, text: string, kind = "guest") {
  await Promise.allSettled([
    sendTelegramToGuest(bookingId, text, kind),
    sendMaxToGuest(bookingId, text, kind),
  ]);
}
