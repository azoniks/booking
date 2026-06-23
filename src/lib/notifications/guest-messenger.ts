import { prisma } from "@/lib/db";
import { getTelegramConfig } from "./telegram";
import { getMaxConfig } from "./max";
import { normalizePhone } from "@/lib/phone";

/**
 * Привязывает chat_id клиента по publicCode. Сохраняет привязку постоянно —
 * в GuestContact по нормализованному телефону гостя, поэтому уведомления будут
 * приходить по всем бронями этого номера (текущим и будущим). Дополнительно
 * пишет chat_id и в саму бронь (для немедленного приветствия и совместимости).
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

  const chatField = args.channel === "telegram" ? "telegramChatId" : "maxChatId";

  // Постоянная подписка: привязка по телефону гостя.
  const phone = normalizePhone(booking.guestPhone);
  if (phone) {
    await prisma.guestContact.upsert({
      where: { phone },
      create: { phone, [chatField]: args.chatId },
      update: { [chatField]: args.chatId },
    });
  }

  // Текущая бронь — для немедленного приветствия и обратной совместимости.
  await prisma.booking.update({
    where: { id: booking.id },
    data: { [chatField]: args.chatId },
  });
  return booking;
}

/**
 * Резолвит chat_id гостя для брони: сперва из самой брони, затем из постоянной
 * подписки GuestContact по нормализованному телефону.
 */
async function resolveGuestChatId(
  booking: { telegramChatId: string | null; maxChatId: string | null; guestPhone: string },
  channel: "telegram" | "max",
): Promise<string | null> {
  const own = channel === "telegram" ? booking.telegramChatId : booking.maxChatId;
  if (own) return own;
  const phone = normalizePhone(booking.guestPhone);
  if (!phone) return null;
  const contact = await prisma.guestContact.findUnique({ where: { phone } });
  if (!contact) return null;
  return channel === "telegram" ? contact.telegramChatId : contact.maxChatId;
}

/** Есть ли у гостя (по телефону) постоянная подписка на канал. */
export async function guestHasSubscription(
  phone: string,
  channel: "telegram" | "max",
): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const contact = await prisma.guestContact.findUnique({ where: { phone: normalized } });
  if (!contact) return false;
  return Boolean(channel === "telegram" ? contact.telegramChatId : contact.maxChatId);
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
  if (!b) return;
  const chatId = await resolveGuestChatId(b, "telegram");
  if (!chatId) return;
  if (!(await clientEnabled("telegram"))) return;
  const cfg = await getTelegramConfig();
  if (!cfg.token) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) throw new Error(`Telegram ${res.status}: ${await res.text()}`);
    await prisma.notificationLog.create({
      data: { bookingId, channel: "TELEGRAM", kind, recipient: chatId, status: "sent" },
    });
  } catch (e) {
    await prisma.notificationLog.create({
      data: {
        bookingId,
        channel: "TELEGRAM",
        kind,
        recipient: chatId,
        status: "failed",
        error: String(e).slice(0, 500),
      },
    });
  }
}

/** Отправка клиенту через MAX (если он подписался). */
export async function sendMaxToGuest(bookingId: string, text: string, kind = "guest") {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) return;
  const chatId = await resolveGuestChatId(b, "max");
  if (!chatId) return;
  if (!(await clientEnabled("max"))) return;
  const cfg = await getMaxConfig();
  if (!cfg.token) return;
  try {
    const url = `${cfg.apiUrl}/messages?access_token=${encodeURIComponent(
      cfg.token,
    )}&chat_id=${encodeURIComponent(chatId)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`MAX ${res.status}: ${await res.text()}`);
    await prisma.notificationLog.create({
      data: { bookingId, channel: "MAX", kind, recipient: chatId, status: "sent" },
    });
  } catch (e) {
    await prisma.notificationLog.create({
      data: {
        bookingId,
        channel: "MAX",
        kind,
        recipient: chatId,
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
