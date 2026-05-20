import { NextRequest } from "next/server";
import { readWebhookSecret } from "@/lib/notifications/webhook-secret";
import { linkGuestChat } from "@/lib/notifications/guest-messenger";
import { getTelegramConfig } from "@/lib/notifications/telegram";
import { formatLocal } from "@/lib/time";
import { prisma } from "@/lib/db";

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; username?: string; first_name?: string };
    chat: { id: number; type: string };
    text?: string;
  };
}

async function reply(chatId: number, text: string) {
  const cfg = await getTelegramConfig();
  if (!cfg.token) return;
  await fetch(`https://api.telegram.org/bot${cfg.token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  }).catch(() => null);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params;
  const expected = await readWebhookSecret("telegram");
  if (!expected || secret !== expected) {
    return new Response("forbidden", { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const msg = update.message;
  if (!msg || !msg.text) return new Response("ok");

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // /start <publicCode>
  const m = /^\/start(?:@\w+)?(?:\s+(\S+))?/i.exec(text);
  if (m) {
    const code = (m[1] || "").trim();
    if (!code) {
      await reply(
        chatId,
        "Здравствуйте! Чтобы получать уведомления о брони, перейдите по ссылке со страницы подтверждения брони.",
      );
      return new Response("ok");
    }
    const booking = await linkGuestChat({
      channel: "telegram",
      publicCode: code,
      chatId: String(chatId),
    });
    if (!booking) {
      await reply(chatId, `Бронь с кодом ${code} не найдена.`);
      return new Response("ok");
    }
    const full = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { object: { include: { objectType: { include: { category: true } } } } },
    });
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
      `Уведомления по брони <b>${booking.publicCode}</b> подключены.`,
      ``,
      `Объект: ${full?.object.name}`,
      `Время: ${formatLocal(booking.startAt)} — ${formatLocal(booking.endAt)}`,
      ...priceLines,
      ``,
      `Я напишу вам перед заездом.`,
    ].join("\n");
    await reply(chatId, greeting);
    return new Response("ok");
  }

  // На любые другие сообщения отдаём подсказку
  await reply(
    chatId,
    "Я уведомительный бот. Перейдите со страницы успешной брони, чтобы подключить уведомления по своей брони.",
  );
  return new Response("ok");
}
