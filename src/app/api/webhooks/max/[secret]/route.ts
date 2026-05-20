import { NextRequest } from "next/server";
import { readWebhookSecret } from "@/lib/notifications/webhook-secret";
import { linkGuestChat } from "@/lib/notifications/guest-messenger";
import { getMaxConfig } from "@/lib/notifications/max";
import { formatLocal } from "@/lib/time";
import { prisma } from "@/lib/db";

/**
 * MAX (Tamtam) Bot API: входящие апдейты.
 * https://dev.max.ru/docs-api/methods/subscriptions
 *
 * Полезные типы:
 *  - update_type = "message_created" — message.body.text, message.recipient.chat_id
 *  - update_type = "bot_started" — sender.user_id, payload (со start)
 */
interface MaxUpdate {
  update_type?: string;
  message?: {
    body?: { text?: string };
    recipient?: { chat_id?: number };
    sender?: { user_id?: number };
  };
  chat_id?: number;
  user_id?: number;
  payload?: string;
}

async function reply(apiUrl: string, token: string, chatId: number | string, text: string) {
  const url = `${apiUrl}/messages?access_token=${encodeURIComponent(token)}&chat_id=${encodeURIComponent(String(chatId))}`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  }).catch(() => null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const expected = await readWebhookSecret("max");
  if (!expected || secret !== expected) {
    return new Response("forbidden", { status: 403 });
  }

  let update: MaxUpdate;
  try {
    update = (await req.json()) as MaxUpdate;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const cfg = await getMaxConfig();
  if (!cfg.token) return new Response("ok");

  // bot_started — приходит когда пользователь запустил бота
  if (update.update_type === "bot_started") {
    const chatId = update.chat_id ?? update.user_id;
    if (!chatId) return new Response("ok");
    const code = (update.payload || "").trim();
    if (!code) {
      await reply(cfg.apiUrl, cfg.token, chatId, "Здравствуйте! Перейдите по ссылке со страницы подтверждения брони.");
      return new Response("ok");
    }
    const booking = await linkGuestChat({ channel: "max", publicCode: code, chatId: String(chatId) });
    if (!booking) {
      await reply(cfg.apiUrl, cfg.token, chatId, `Бронь с кодом ${code} не найдена.`);
      return new Response("ok");
    }
    const total = Number(booking.totalPrice);
    const prepay = Number(booking.prepaymentAmount);
    const remaining = Math.max(0, total - prepay);
    const priceLines =
      remaining > 0 && prepay > 0
        ? [
            `Полная стоимость: ${total} ₽`,
            `Оплачено онлайн: ${prepay} ₽`,
            `К оплате при заселении: ${remaining.toFixed(2)} ₽`,
          ]
        : [`Сумма: ${total} ₽`];
    const greeting = [
      `Здравствуйте, ${booking.guestName}!`,
      `Уведомления по брони ${booking.publicCode} подключены.`,
      `Время: ${formatLocal(booking.startAt)} — ${formatLocal(booking.endAt)}`,
      ...priceLines,
    ].join("\n");
    await reply(cfg.apiUrl, cfg.token, chatId, greeting);
    return new Response("ok");
  }

  // message_created — обычное сообщение, может прийти "/start <code>" текстом
  if (update.update_type === "message_created" || update.message) {
    const chatId = update.message?.recipient?.chat_id ?? update.message?.sender?.user_id;
    const text = update.message?.body?.text?.trim() || "";
    if (!chatId) return new Response("ok");

    const m = /^\/start(?:\s+(\S+))?/i.exec(text);
    if (m) {
      const code = (m[1] || "").trim();
      if (!code) {
        await reply(cfg.apiUrl, cfg.token, chatId, "Перейдите по ссылке со страницы подтверждения брони.");
        return new Response("ok");
      }
      const booking = await linkGuestChat({ channel: "max", publicCode: code, chatId: String(chatId) });
      if (!booking) {
        await reply(cfg.apiUrl, cfg.token, chatId, `Бронь с кодом ${code} не найдена.`);
        return new Response("ok");
      }
      const greeting = [
        `Здравствуйте, ${booking.guestName}!`,
        `Уведомления по брони ${booking.publicCode} подключены.`,
        `Время: ${formatLocal(booking.startAt)} — ${formatLocal(booking.endAt)}`,
      ].join("\n");
      await reply(cfg.apiUrl, cfg.token, chatId, greeting);
      return new Response("ok");
    }

    await reply(cfg.apiUrl, cfg.token, chatId, "Я уведомительный бот. Откройте ссылку с страницы брони.");
  }

  // подавляем неизвестные апдейты
  void prisma;
  return new Response("ok");
}
