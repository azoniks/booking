import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { formatLocal } from "@/lib/time";
import { sendTelegram } from "./telegram";
import { sendMax } from "./max";
import { sendToGuestAll, guestHasSubscription } from "./guest-messenger";

const PAYMENT_RETRY_KIND = "payment_retry";
// Письмо клиенту со ссылкой на оплату при создании брони/заказа и напоминание
// перед авто-отменой (kind-и разные, чтобы каждое ушло один раз).
const PAYMENT_LINK_KIND = "guest_payment_link";
const PAYMENT_LINK_GROUP_KIND = "guest_payment_link_group";
const PAYMENT_REMINDER_KIND = "payment_expiry_reminder";
const PAYMENT_REMINDER_GROUP_KIND = "payment_expiry_reminder_group";

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean; // SSL (порт 465)
  user: string;
  password: string;
  from: string;
  source: "db" | "env" | "console";
}

async function loadString(key: string): Promise<string | null> {
  const s = await prisma.settings.findUnique({ where: { key } });
  if (!s || s.value === null || s.value === undefined) return null;
  return String(s.value);
}

/**
 * Резолвит конфиг почты:
 * 1) если в БД задан smtpEnabled='true' и есть smtpHost — берём оттуда;
 * 2) иначе — env.SMTP_HOST если есть;
 * 3) иначе — консольный fallback.
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  const [enabled, host, portRaw, user, pwd, from] = await Promise.all([
    loadString("smtpEnabled"),
    loadString("smtpHost"),
    loadString("smtpPort"),
    loadString("smtpUser"),
    loadString("smtpPassword"),
    loadString("smtpFrom"),
  ]);

  const dbHost = (host || "").trim();
  if (enabled !== "false" && dbHost) {
    const port = Number(portRaw) || 465;
    return {
      enabled: true,
      host: dbHost,
      port,
      secure: port === 465,
      user: (user || "").trim(),
      password: (pwd || "").trim(),
      from: (from || "").trim() || env.SMTP_FROM,
      source: "db",
    };
  }

  if (env.SMTP_HOST) {
    return {
      enabled: true,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
      source: "env",
    };
  }

  return {
    enabled: false,
    host: "",
    port: 0,
    secure: false,
    user: "",
    password: "",
    from: env.SMTP_FROM,
    source: "console",
  };
}

async function buildTransporter(cfg: EmailConfig): Promise<Transporter> {
  if (cfg.source === "console") {
    return nodemailer.createTransport({ jsonTransport: true });
  }
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
  });
}

async function sendEmail(args: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  bookingId?: string;
  kind: string;
}) {
  const cfg = await getEmailConfig();
  try {
    const t = await buildTransporter(cfg);
    const info = await t.sendMail({
      from: cfg.from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    if (cfg.source === "console") {
      console.log(`\n[EMAIL → ${args.to}] ${args.subject}\n${args.text}\n`);
    }
    await prisma.notificationLog.create({
      data: {
        bookingId: args.bookingId,
        channel: "EMAIL",
        kind: args.kind,
        recipient: args.to,
        status: "sent",
      },
    });
    return info;
  } catch (e) {
    await prisma.notificationLog.create({
      data: {
        bookingId: args.bookingId,
        channel: "EMAIL",
        kind: args.kind,
        recipient: args.to,
        status: "failed",
        error: String(e).slice(0, 500),
      },
    });
    throw e;
  }
}

/** Тестовая отправка одиночного письма (для админ-кнопки). */
export async function sendTestEmail(to: string) {
  const cfg = await getEmailConfig();
  const t = await buildTransporter(cfg);
  await t.sendMail({
    from: cfg.from,
    to,
    subject: "Тестовое письмо из админки бронирования",
    text: `Это тестовое письмо.\nВремя отправки: ${new Date().toLocaleString("ru-RU")}\nИсточник конфига: ${cfg.source}`,
  });
  return { source: cfg.source, host: cfg.host || "(console)" };
}

async function getAdminEmails(): Promise<string[]> {
  const rec = await prisma.settings.findUnique({ where: { key: "adminNotifyEmails" } });
  if (rec && Array.isArray(rec.value)) return rec.value as string[];
  return [];
}

// Человеческий статус оплаты для уведомлений с учётом модели предоплаты
// (аванс онлайн + остаток на месте). split = бронь оплачивается частями.
function paymentStatusLine(status: string, prepay: number, remaining: number): string {
  const split = prepay > 0 && remaining > 0;
  switch (status) {
    case "PENDING":
      return split
        ? "ожидает предоплаты (аванс онлайн, остаток на месте)"
        : "ожидает оплаты";
    case "PREPAID":
      return split
        ? `аванс внесён, остаток ${remaining.toFixed(2)} ₽ — на месте`
        : "оплачено";
    case "PAID":
      return "оплачено полностью";
    case "CANCELLED":
      return "отменена";
    case "COMPLETED":
      return "завершена";
    case "NO_SHOW":
      return "гость не пришёл";
    default:
      return status;
  }
}

export async function sendNewBookingNotifications(bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { object: { include: { objectType: { include: { category: true } } } } },
  });
  if (!b) return;

  // Идемпотентность: если уведомление о новой брони уже уходило — не повторяем.
  // Нужно как для повторных вызовов, так и для фолбэка из sendPaidNotifications
  // (уведомление о создании — fire-and-forget и могло молча не отправиться).
  const already = await prisma.notificationLog.count({
    where: { bookingId, kind: "admin_new_booking", status: "sent" },
  });
  if (already > 0) return;

  // Гостю — после оплаты, не сразу. Здесь только админу.
  const admins = await getAdminEmails();
  const total = Number(b.totalPrice);
  const prepay = Number(b.prepaymentAmount);
  const remaining = Math.max(0, total - prepay);
  const prepayLabel =
    b.paymentType === "FIXED"
      ? "Предоплата онлайн (фикс. сумма)"
      : `Предоплата онлайн (${b.paymentPercent}%)`;
  const priceLines =
    remaining > 0 && prepay > 0
      ? [
          `Полная стоимость: ${total} ₽`,
          `${prepayLabel}: ${prepay} ₽`,
          `Остаток при заселении: ${remaining.toFixed(2)} ₽`,
        ]
      : [`Сумма: ${total} ₽`];
  const text = [
    `Новая бронь ${b.publicCode}`,
    `Объект: ${b.object.name} (${b.object.objectType.category.name})`,
    `Гость: ${b.guestName}, ${b.guestPhone}, ${b.guestEmail}`,
    `Гостей: ${b.guestsCount}`,
    `${formatLocal(b.startAt)} → ${formatLocal(b.endAt)}`,
    ...priceLines,
    `Статус: ${paymentStatusLine(b.status, prepay, remaining)}`,
  ].join("\n");

  await Promise.allSettled([
    ...admins.map((to) =>
      sendEmail({
        to,
        subject: `Новая бронь ${b.publicCode}`,
        text,
        bookingId,
        kind: "admin_new_booking",
      }),
    ),
    sendTelegram(text, bookingId, "admin_new_booking"),
    sendMax(text, bookingId, "admin_new_booking"),
  ]);
}

export async function sendPaidNotifications(bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { object: { include: { objectType: { include: { category: true } } } } },
  });
  if (!b) return;

  // Защита от дублей: если уведомление об оплате уже уходило — не повторяем.
  const alreadyPaidNotified = await prisma.notificationLog.count({
    where: { bookingId, kind: { in: ["guest_paid", "admin_paid"] }, status: "sent" },
  });
  if (alreadyPaidNotified > 0) return;

  // Фолбэк: гарантируем, что уведомление о НОВОЙ броне ушло раньше уведомления
  // об оплате (при создании оно fire-and-forget и могло молча упасть — тогда
  // админ видел «оплату» без «новой брони»). Идемпотентно — если уже было, no-op.
  await sendNewBookingNotifications(bookingId).catch(() => {});

  const remaining = Number(b.totalPrice) - Number(b.prepaymentAmount);
  const guestLines = [
    `Здравствуйте, ${b.guestName}!`,
    `Ваша бронь ${b.publicCode} оплачена и подтверждена.`,
    ``,
    `Объект: ${b.object.name}`,
    `Категория: ${b.object.objectType.category.name}`,
    `Время: ${formatLocal(b.startAt)} — ${formatLocal(b.endAt)}`,
    `Гостей: ${b.guestsCount}`,
    `Полная стоимость: ${b.totalPrice} ₽`,
  ];
  if (remaining > 0 && Number(b.prepaymentAmount) > 0) {
    const paidLabel =
      b.paymentType === "FIXED"
        ? "Оплачено онлайн (фикс. предоплата)"
        : `Оплачено онлайн (предоплата ${b.paymentPercent}%)`;
    guestLines.push(
      `${paidLabel}: ${b.prepaymentAmount} ₽`,
      `Остаток к оплате на месте: ${remaining.toFixed(2)} ₽`,
    );
  } else {
    guestLines.push(`Оплачено: ${b.prepaymentAmount} ₽`);
  }
  // Опт-ин в мессенджеры (если включены)
  const channels = await prisma.settings.findMany({
    where: {
      key: { in: ["telegramClientEnabled", "telegramBotUsername", "maxClientEnabled", "maxBotUsername"] },
    },
  });
  const ch: Record<string, string> = {};
  for (const s of channels) ch[s.key] = String(s.value ?? "");
  // Не показываем ссылку-подписку гостю, который уже подписан (по телефону).
  const [tgSubscribed, maxSubscribed] = await Promise.all([
    guestHasSubscription(b.guestPhone, "telegram"),
    guestHasSubscription(b.guestPhone, "max"),
  ]);
  if (ch.telegramClientEnabled === "true" && ch.telegramBotUsername && !tgSubscribed) {
    guestLines.push(``, `Получать уведомления в Telegram: https://t.me/${ch.telegramBotUsername}?start=${b.publicCode}`);
  }
  if (ch.maxClientEnabled === "true" && ch.maxBotUsername && !maxSubscribed) {
    guestLines.push(`Получать уведомления в MAX: https://max.ru/${ch.maxBotUsername}?start=${b.publicCode}`);
  }
  guestLines.push(``, `До встречи!`);
  const guestText = guestLines.join("\n");

  const admins = await getAdminEmails();
  const adminPaidLine =
    remaining > 0 && Number(b.prepaymentAmount) > 0
      ? `аванс ${b.prepaymentAmount} ₽ внесён, остаток ${remaining.toFixed(2)} ₽ — на месте`
      : "оплачена полностью";
  const adminText = `Бронь ${b.publicCode}: ${adminPaidLine}. ${b.guestName}, ${b.object.name}, ${formatLocal(b.startAt)}.`;

  await Promise.allSettled([
    sendEmail({
      to: b.guestEmail,
      subject: `Бронь ${b.publicCode} подтверждена`,
      text: guestText,
      bookingId,
      kind: "guest_paid",
    }),
    ...admins.map((to) =>
      sendEmail({
        to,
        subject: `Оплата по брони ${b.publicCode}`,
        text: adminText,
        bookingId,
        kind: "admin_paid",
      }),
    ),
    sendTelegram(adminText, bookingId, "admin_paid"),
    sendMax(adminText, bookingId, "admin_paid"),
    // Клиенту в его подписанные мессенджеры
    sendToGuestAll(bookingId, guestText, "guest_paid"),
  ]);
}

async function loadGroup(groupId: string) {
  return prisma.bookingGroup.findUnique({
    where: { id: groupId },
    include: {
      bookings: {
        include: { object: { include: { objectType: { include: { category: true } } } } },
        orderBy: { startAt: "asc" },
      },
    },
  });
}

function groupItemLines(
  bookings: {
    publicCode: string;
    startAt: Date;
    endAt: Date;
    guestsCount: number;
    totalPrice: unknown;
    object: { name: string; objectType: { category: { name: string } } };
  }[],
): string[] {
  return bookings.map(
    (b) =>
      `• ${b.publicCode} — ${b.object.name} (${b.object.objectType.category.name}): ` +
      `${formatLocal(b.startAt)} → ${formatLocal(b.endAt)}, ${b.guestsCount} гост., ${b.totalPrice} ₽`,
  );
}

/** Админу — о новом групповом заказе (до оплаты). Одно агрегированное сообщение. */
export async function sendNewBookingGroupNotifications(groupId: string) {
  const g = await loadGroup(groupId);
  if (!g) return;

  // Идемпотентность (по первой броне заказа) — как для одиночной брони.
  const firstId = g.bookings[0]?.id;
  if (firstId) {
    const already = await prisma.notificationLog.count({
      where: { bookingId: firstId, kind: "admin_new_group", status: "sent" },
    });
    if (already > 0) return;
  }

  const total = Number(g.totalPrice);
  const prepay = Number(g.prepaymentAmount);
  const remaining = Math.max(0, total - prepay);
  const priceLines =
    remaining > 0 && prepay > 0
      ? [
          `Полная стоимость: ${total} ₽`,
          `Предоплата онлайн: ${prepay} ₽`,
          `Остаток при заселении: ${remaining.toFixed(2)} ₽`,
        ]
      : [`Сумма: ${total} ₽`];
  const text = [
    `Новый заказ ${g.publicCode} (${g.bookings.length} объ.)`,
    `Гость: ${g.guestName}, ${g.guestPhone}, ${g.guestEmail}`,
    ``,
    ...groupItemLines(g.bookings),
    ``,
    ...priceLines,
    `Статус: ${paymentStatusLine(g.status, prepay, remaining)}`,
  ].join("\n");

  const admins = await getAdminEmails();
  const firstBookingId = g.bookings[0]?.id;
  await Promise.allSettled([
    ...admins.map((to) =>
      sendEmail({
        to,
        subject: `Новый заказ ${g.publicCode} (${g.bookings.length} объ.)`,
        text,
        bookingId: firstBookingId,
        kind: "admin_new_group",
      }),
    ),
    sendTelegram(text, firstBookingId, "admin_new_group"),
    sendMax(text, firstBookingId, "admin_new_group"),
  ]);
}

/** Клиенту + админу — об оплате группового заказа. */
export async function sendPaidGroupNotifications(groupId: string) {
  const g = await loadGroup(groupId);
  if (!g) return;

  // Защита от дублей по первой броне заказа.
  const firstId = g.bookings[0]?.id;
  if (firstId) {
    const alreadyPaidNotified = await prisma.notificationLog.count({
      where: {
        bookingId: firstId,
        kind: { in: ["guest_paid_group", "admin_paid_group"] },
        status: "sent",
      },
    });
    if (alreadyPaidNotified > 0) return;
  }

  // Фолбэк: гарантируем уведомление о новом заказе перед уведомлением об оплате.
  await sendNewBookingGroupNotifications(groupId).catch(() => {});

  const total = Number(g.totalPrice);
  const prepay = Number(g.prepaymentAmount);
  const remaining = Math.max(0, total - prepay);

  const guestLines = [
    `Здравствуйте, ${g.guestName}!`,
    `Ваш заказ ${g.publicCode} оплачен и подтверждён.`,
    ``,
    ...groupItemLines(g.bookings),
    ``,
    `Полная стоимость: ${total} ₽`,
  ];
  if (remaining > 0 && prepay > 0) {
    guestLines.push(
      `Оплачено онлайн (предоплата): ${prepay} ₽`,
      `Остаток к оплате на месте: ${remaining.toFixed(2)} ₽`,
    );
  } else {
    guestLines.push(`Оплачено: ${prepay} ₽`);
  }
  guestLines.push(``, `До встречи!`);
  const guestText = guestLines.join("\n");

  const admins = await getAdminEmails();
  const adminText = `Заказ ${g.publicCode} оплачен. ${g.guestName}, ${g.bookings.length} объ., ${prepay} ₽.`;
  const firstBookingId = g.bookings[0]?.id;

  await Promise.allSettled([
    sendEmail({
      to: g.guestEmail,
      subject: `Заказ ${g.publicCode} подтверждён`,
      text: guestText,
      bookingId: firstBookingId,
      kind: "guest_paid_group",
    }),
    ...admins.map((to) =>
      sendEmail({
        to,
        subject: `Оплата по заказу ${g.publicCode}`,
        text: adminText,
        bookingId: firstBookingId,
        kind: "admin_paid_group",
      }),
    ),
    sendTelegram(adminText, firstBookingId, "admin_paid_group"),
    sendMax(adminText, firstBookingId, "admin_paid_group"),
  ]);
}

/**
 * Письмо клиенту о повторной попытке оплаты после отказа банка.
 * Идемпотентно: при повторном вызове письмо не отправится повторно
 * (проверяется по NotificationLog для kind="payment_retry").
 */
export async function sendPaymentRetryEmail(bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { object: { include: { objectType: { include: { category: true } } } } },
  });
  if (!b) return;
  if (b.status !== "PENDING") return;

  const already = await prisma.notificationLog.count({
    where: { bookingId, kind: PAYMENT_RETRY_KIND, status: "sent" },
  });
  if (already > 0) return;

  const retryUrl = `${env.APP_URL}/booking/retry?code=${b.publicCode}`;
  const elapsedMin = (Date.now() - b.createdAt.getTime()) / 60_000;
  const remainingMin = Math.max(0, Math.ceil(env.PAYMENT_TIMEOUT_MINUTES - elapsedMin));

  const text = [
    `Здравствуйте, ${b.guestName}!`,
    `К сожалению, оплата по брони ${b.publicCode} не прошла.`,
    ``,
    `Объект: ${b.object.name}`,
    `Время: ${formatLocal(b.startAt)} — ${formatLocal(b.endAt)}`,
    `Сумма к оплате: ${b.prepaymentAmount} ₽`,
    ``,
    `Вы можете повторить попытку оплаты по ссылке:`,
    retryUrl,
    ``,
    remainingMin > 0
      ? `Бронь будет автоматически отменена через ~${remainingMin} мин., если оплата не поступит.`
      : `Срок оплаты истёк, бронь будет отменена в ближайшие минуты.`,
  ].join("\n");

  await sendEmail({
    to: b.guestEmail,
    subject: `Повторная оплата по брони ${b.publicCode}`,
    text,
    bookingId,
    kind: PAYMENT_RETRY_KIND,
  });
}

/**
 * Письмо клиенту со ссылкой на оплату одиночной брони. reminder=false — при
 * создании (чтобы клиент мог вернуться к оплате, даже закрыв вкладку);
 * reminder=true — напоминание перед авто-отменой. Шлётся один раз (по kind),
 * только для PENDING-броней с указанным email.
 */
export async function sendPaymentLinkEmail(
  bookingId: string,
  opts: { reminder?: boolean } = {},
) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { object: true },
  });
  if (!b || b.status !== "PENDING" || !b.guestEmail) return;

  const kind = opts.reminder ? PAYMENT_REMINDER_KIND : PAYMENT_LINK_KIND;
  const already = await prisma.notificationLog.count({
    where: { bookingId, kind, status: "sent" },
  });
  if (already > 0) return;

  const payUrl = `${env.APP_URL}/booking/retry?code=${b.publicCode}`;
  const elapsedMin = (Date.now() - b.createdAt.getTime()) / 60_000;
  const remainingMin = Math.max(0, Math.ceil(env.PAYMENT_TIMEOUT_MINUTES - elapsedMin));
  const head = opts.reminder
    ? `Бронь ${b.publicCode} ещё не оплачена и скоро будет автоматически отменена.`
    : `Бронь ${b.publicCode} создана. Чтобы подтвердить её, оплатите по ссылке ниже.`;

  const text = [
    `Здравствуйте, ${b.guestName}!`,
    head,
    ``,
    `Объект: ${b.object.name}`,
    `Время: ${formatLocal(b.startAt)} — ${formatLocal(b.endAt)}`,
    `К оплате онлайн: ${b.prepaymentAmount} ₽`,
    ``,
    `Ссылка для оплаты:`,
    payUrl,
    ``,
    remainingMin > 0
      ? `Бронь будет автоматически отменена через ~${remainingMin} мин., если оплата не поступит.`
      : `Срок оплаты истекает — оплатите как можно скорее.`,
  ].join("\n");

  await sendEmail({
    to: b.guestEmail,
    subject: opts.reminder
      ? `Бронь ${b.publicCode}: оплатите, чтобы не потерять`
      : `Оплата брони ${b.publicCode}`,
    text,
    bookingId,
    kind,
  });
}

/**
 * Гостю — об авто-отмене брони из-за неоплаты. Шлётся один раз. Для броней в
 * составе заказа (groupId) пропускаем, чтобы не дублировать на каждый объект —
 * у заказа отмена уведомляется отдельно.
 */
export async function sendBookingExpiredEmail(bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { object: true },
  });
  if (!b || b.groupId) return;

  const text = [
    `Здравствуйте, ${b.guestName}!`,
    `Бронь ${b.publicCode} отменена: оплата не поступила в течение отведённого времени.`,
    ``,
    `Объект: ${b.object.name}`,
    `Время: ${formatLocal(b.startAt)} — ${formatLocal(b.endAt)}`,
    ``,
    `Если бронь всё ещё актуальна — оформите её заново на сайте.`,
  ].join("\n");

  await Promise.allSettled([
    b.guestEmail
      ? sendEmail({
          to: b.guestEmail,
          subject: `Бронь ${b.publicCode} отменена`,
          text,
          bookingId,
          kind: "guest_expired",
        })
      : Promise.resolve(),
    // В подписанные мессенджеры гостя (если есть).
    sendToGuestAll(bookingId, text, "guest_expired"),
  ]);
}

/** То же, но для группового заказа (ссылка /booking/retry?group=...). */
export async function sendPaymentLinkGroupEmail(
  groupId: string,
  opts: { reminder?: boolean } = {},
) {
  const g = await prisma.bookingGroup.findUnique({
    where: { id: groupId },
    include: { bookings: { select: { id: true } } },
  });
  if (!g || g.status !== "PENDING" || !g.guestEmail) return;
  const firstBookingId = g.bookings[0]?.id;

  const kind = opts.reminder ? PAYMENT_REMINDER_GROUP_KIND : PAYMENT_LINK_GROUP_KIND;
  const already = await prisma.notificationLog.count({
    where: { bookingId: firstBookingId, kind, status: "sent" },
  });
  if (already > 0) return;

  const payUrl = `${env.APP_URL}/booking/retry?group=${g.publicCode}`;
  const elapsedMin = (Date.now() - g.createdAt.getTime()) / 60_000;
  const remainingMin = Math.max(0, Math.ceil(env.PAYMENT_TIMEOUT_MINUTES - elapsedMin));
  const head = opts.reminder
    ? `Заказ ${g.publicCode} ещё не оплачен и скоро будет автоматически отменён.`
    : `Заказ ${g.publicCode} создан. Чтобы подтвердить его, оплатите по ссылке ниже.`;

  const text = [
    `Здравствуйте, ${g.guestName}!`,
    head,
    ``,
    `Объектов в заказе: ${g.bookings.length}`,
    `К оплате онлайн: ${g.prepaymentAmount} ₽`,
    ``,
    `Ссылка для оплаты:`,
    payUrl,
    ``,
    remainingMin > 0
      ? `Заказ будет автоматически отменён через ~${remainingMin} мин., если оплата не поступит.`
      : `Срок оплаты истекает — оплатите как можно скорее.`,
  ].join("\n");

  await sendEmail({
    to: g.guestEmail,
    subject: opts.reminder
      ? `Заказ ${g.publicCode}: оплатите, чтобы не потерять`
      : `Оплата заказа ${g.publicCode}`,
    text,
    bookingId: firstBookingId,
    kind,
  });
}

export async function sendReminder(bookingId: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { object: { include: { objectType: { include: { category: true } } } } },
  });
  if (!b) return;

  const text = [
    `Здравствуйте, ${b.guestName}!`,
    `Напоминаем о вашей брони ${b.publicCode}.`,
    `${b.object.name} — ${formatLocal(b.startAt)}.`,
    `Ждём вас!`,
  ].join("\n");

  await Promise.allSettled([
    sendEmail({
      to: b.guestEmail,
      subject: `Напоминание о брони ${b.publicCode}`,
      text,
      bookingId,
      kind: "reminder_24h",
    }),
    sendToGuestAll(bookingId, text, "reminder_24h"),
  ]);
  await prisma.booking.update({
    where: { id: bookingId },
    data: { reminderSentAt: new Date() },
  });
}

/** Уведомление клиенту об изменении брони (cancel/confirm/etc). */
export async function sendStatusChangeNotifications(bookingId: string, newStatus: string) {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { object: { include: { objectType: { include: { category: true } } } } },
  });
  if (!b) return;
  const titles: Record<string, string> = {
    PREPAID: "ожидает доплаты (аванс получен)",
    PAID: "подтверждена",
    CANCELLED: "отменена",
    COMPLETED: "завершена",
    NO_SHOW: "помечена как «не пришёл»",
  };
  const title = titles[newStatus] || `переведена в статус ${newStatus}`;
  const text = [
    `Здравствуйте, ${b.guestName}!`,
    `Ваша бронь ${b.publicCode} ${title}.`,
    `${b.object.name} — ${formatLocal(b.startAt)}.`,
  ].join("\n");

  await Promise.allSettled([
    sendEmail({
      to: b.guestEmail,
      subject: `Бронь ${b.publicCode}: ${title}`,
      text,
      bookingId,
      kind: `status_${newStatus.toLowerCase()}`,
    }),
    sendToGuestAll(bookingId, text, `status_${newStatus.toLowerCase()}`),
  ]);
}
