import { createHash, createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";

interface TinkoffInitResponse {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  PaymentId?: string;
  PaymentURL?: string;
}

type TinkoffTax = "none" | "vat0" | "vat10" | "vat20" | "vat110" | "vat120";
type TinkoffTaxation =
  | "osn"
  | "usn_income"
  | "usn_income_outcome"
  | "patent"
  | "envd"
  | "esn";
type TinkoffPaymentMethod =
  | "full_prepayment"
  | "prepayment"
  | "advance"
  | "full_payment"
  | "partial_payment"
  | "credit"
  | "credit_payment";
type TinkoffPaymentObject =
  | "commodity"
  | "excise"
  | "job"
  | "service"
  | "gambling_bet"
  | "gambling_prize"
  | "lottery"
  | "lottery_prize"
  | "intellectual_activity"
  | "payment"
  | "agent_commission"
  | "composite"
  | "another";

interface TinkoffReceiptItem {
  Name: string;
  Price: number;
  Quantity: number;
  Amount: number;
  Tax: TinkoffTax;
  PaymentMethod: TinkoffPaymentMethod;
  PaymentObject: TinkoffPaymentObject;
}

interface TinkoffReceipt {
  Email?: string;
  Phone?: string;
  Taxation: TinkoffTaxation;
  Items: TinkoffReceiptItem[];
}

const RECEIPT_TAXATION: TinkoffTaxation = "usn_income_outcome";
const RECEIPT_TAX: TinkoffTax = "none";
const RECEIPT_PAYMENT_METHOD: TinkoffPaymentMethod = "prepayment";
const RECEIPT_PAYMENT_OBJECT: TinkoffPaymentObject = "service";

export type TinkoffMode = "mock" | "test" | "production";

export interface TinkoffConfig {
  mode: TinkoffMode;
  terminalKey: string;
  password: string;
  apiUrl: string;
  // Для UI: какие наборы ключей есть в БД
  hasTestCreds: boolean;
  hasProdCreds: boolean;
}

const DEFAULT_API_URL = "https://securepay.tinkoff.ru/v2";

async function loadSetting(key: string): Promise<string | null> {
  const s = await prisma.settings.findUnique({ where: { key } });
  if (!s) return null;
  if (s.value === null || s.value === undefined) return null;
  return String(s.value);
}

/**
 * Резолвим эффективную конфигурацию Tinkoff.
 * Приоритет: Settings из БД → переменные окружения → дефолт (mock).
 */
export async function getTinkoffConfig(): Promise<TinkoffConfig> {
  const [
    modeRaw,
    testKey,
    testPwd,
    prodKey,
    prodPwd,
    apiUrlRaw,
  ] = await Promise.all([
    loadSetting("tinkoffMode"),
    loadSetting("tinkoffTestTerminalKey"),
    loadSetting("tinkoffTestPassword"),
    loadSetting("tinkoffProdTerminalKey"),
    loadSetting("tinkoffProdPassword"),
    loadSetting("tinkoffApiUrl"),
  ]);

  let mode: TinkoffMode;
  if (modeRaw === "mock" || modeRaw === "test" || modeRaw === "production") {
    mode = modeRaw;
  } else {
    // fallback на env: TINKOFF_TEST_MODE=true → mock, иначе production
    mode = env.TINKOFF_TEST_MODE ? "mock" : "production";
  }

  const apiUrl = (apiUrlRaw && apiUrlRaw.trim()) || env.TINKOFF_API_URL || DEFAULT_API_URL;

  let terminalKey = "";
  let password = "";
  if (mode === "test") {
    terminalKey = (testKey && testKey.trim()) || env.TINKOFF_TERMINAL_KEY || "";
    password = (testPwd && testPwd.trim()) || env.TINKOFF_PASSWORD || "";
  } else if (mode === "production") {
    terminalKey = (prodKey && prodKey.trim()) || env.TINKOFF_TERMINAL_KEY || "";
    password = (prodPwd && prodPwd.trim()) || env.TINKOFF_PASSWORD || "";
  }

  return {
    mode,
    terminalKey,
    password,
    apiUrl,
    hasTestCreds: !!(testKey && testPwd),
    hasProdCreds: !!(prodKey && prodPwd),
  };
}

function signTinkoff(
  params: Record<string, string | number | boolean>,
  password: string,
): string {
  const all = { ...params, Password: password };
  const keys = Object.keys(all).sort();
  const concat = keys.map((k) => String((all as Record<string, unknown>)[k])).join("");
  return createHash("sha256").update(concat).digest("hex");
}

export function mockSign(bookingId: string): string {
  return createHmac("sha256", env.MOCK_PAYMENT_SECRET).update(bookingId).digest("hex");
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("7")) return `+${digits}`;
  if (digits.length === 10) return `+7${digits}`;
  return `+${digits}`;
}

// Чек из произвольного списка позиций. Сумма позиций должна совпадать с Amount платежа.
function makeReceipt(
  lineItems: { name: string; amountKopecks: number }[],
  email: string,
  phone: string,
): TinkoffReceipt {
  const Items: TinkoffReceiptItem[] = lineItems.map((li) => ({
    Name: li.name.slice(0, 128),
    Price: li.amountKopecks,
    Quantity: 1,
    Amount: li.amountKopecks,
    Tax: RECEIPT_TAX,
    PaymentMethod: RECEIPT_PAYMENT_METHOD,
    PaymentObject: RECEIPT_PAYMENT_OBJECT,
  }));
  const receipt: TinkoffReceipt = { Taxation: RECEIPT_TAXATION, Items };
  const e = email.trim();
  if (e) receipt.Email = e;
  const p = normalizePhone(phone);
  if (p) receipt.Phone = p;
  return receipt;
}

function buildReceipt(
  booking: {
    guestEmail: string;
    guestPhone: string;
    publicCode: string;
    object: { name: string };
  },
  amountKopecks: number,
): TinkoffReceipt {
  return makeReceipt(
    [{ name: `Предоплата за бронь ${booking.publicCode} — ${booking.object.name}`, amountKopecks }],
    booking.guestEmail,
    booking.guestPhone,
  );
}

export async function initPayment(bookingId: string): Promise<{
  confirmationUrl: string;
  paymentId: string;
}> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { object: true },
  });
  if (!booking) throw new Error("Бронь не найдена");
  const payAmount = booking.prepaymentAmount;
  const amountKopecks = Math.round(Number(payAmount) * 100);

  const cfg = await getTinkoffConfig();

  // Mock-режим: относительный URL — чтобы редирект работал
  // на любом порту dev-сервера, независимо от env.APP_URL.
  if (cfg.mode === "mock") {
    const url = `/payments/mock?bookingId=${bookingId}&sig=${mockSign(bookingId)}`;
    const payment = await prisma.payment.upsert({
      where: { bookingId },
      create: {
        bookingId,
        provider: "tinkoff-mock",
        amount: payAmount,
        currency: "RUB",
        status: "PENDING",
        confirmationUrl: url,
      },
      update: { amount: payAmount, status: "PENDING", confirmationUrl: url },
    });
    return { confirmationUrl: payment.confirmationUrl!, paymentId: payment.id };
  }

  // Реальный Tinkoff (test или production)
  if (!cfg.terminalKey || !cfg.password) {
    throw new Error(
      `Tinkoff не настроен: задайте ${cfg.mode === "test" ? "тестовые" : "боевые"} TerminalKey и Password в админке`,
    );
  }

  // OrderId должен быть уникален в пределах мерчанта (Tinkoff).
  // Для повторных попыток оплаты (после REJECTED) добавляем суффикс,
  // иначе вторая попытка с тем же OrderId падает у банка.
  const orderId = `${booking.publicCode}-${Date.now().toString(36)}`;

  const params: Record<string, string | number> = {
    TerminalKey: cfg.terminalKey,
    Amount: amountKopecks,
    OrderId: orderId,
    Description: `Бронь ${booking.publicCode} (предоплата)`,
    SuccessURL: `${env.APP_URL}/booking/success?code=${booking.publicCode}`,
    FailURL: `${env.APP_URL}/booking/failed?code=${booking.publicCode}`,
    NotificationURL: `${env.APP_URL}/api/payments/tinkoff/webhook`,
  };
  const Token = signTinkoff(params, cfg.password);

  // Receipt не участвует в подсчёте Token (Tinkoff игнорирует объекты при
  // формировании подписи), поэтому добавляем его в тело уже после signTinkoff.
  const Receipt = buildReceipt(booking, amountKopecks);

  const res = await fetch(`${cfg.apiUrl}/Init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, Token, Receipt }),
  });
  const data = (await res.json()) as TinkoffInitResponse;

  if (!data.Success || !data.PaymentURL || !data.PaymentId) {
    throw new Error(`Tinkoff Init failed: ${data.Message || data.ErrorCode}`);
  }

  await prisma.payment.upsert({
    where: { bookingId },
    create: {
      bookingId,
      provider: cfg.mode === "test" ? "tinkoff-test" : "tinkoff",
      externalId: data.PaymentId,
      amount: payAmount,
      currency: "RUB",
      status: "PENDING",
      confirmationUrl: data.PaymentURL,
    },
    update: {
      externalId: data.PaymentId,
      amount: payAmount,
      confirmationUrl: data.PaymentURL,
      status: "PENDING",
    },
  });

  return { confirmationUrl: data.PaymentURL, paymentId: data.PaymentId };
}

/**
 * Инициализация платежа для группы броней (заказа). Сумма = prepaymentAmount
 * группы (= сумма предоплат всех броней). Чек — по позиции на каждую бронь.
 * Создаёт один Payment, привязанный к группе (а не к отдельной брони).
 */
export async function initGroupPayment(groupId: string): Promise<{
  confirmationUrl: string;
  paymentId: string;
}> {
  const group = await prisma.bookingGroup.findUnique({
    where: { id: groupId },
    include: { bookings: { include: { object: true } } },
  });
  if (!group) throw new Error("Заказ не найден");
  const payAmount = group.prepaymentAmount;
  const amountKopecks = Math.round(Number(payAmount) * 100);

  const cfg = await getTinkoffConfig();

  if (cfg.mode === "mock") {
    const url = `/payments/mock?group=${groupId}&sig=${mockSign(groupId)}`;
    const payment = await prisma.payment.upsert({
      where: { groupId },
      create: {
        groupId,
        provider: "tinkoff-mock",
        amount: payAmount,
        currency: "RUB",
        status: "PENDING",
        confirmationUrl: url,
      },
      update: { amount: payAmount, status: "PENDING", confirmationUrl: url },
    });
    return { confirmationUrl: payment.confirmationUrl!, paymentId: payment.id };
  }

  if (!cfg.terminalKey || !cfg.password) {
    throw new Error(
      `Tinkoff не настроен: задайте ${cfg.mode === "test" ? "тестовые" : "боевые"} TerminalKey и Password в админке`,
    );
  }

  const orderId = `${group.publicCode}-${Date.now().toString(36)}`;
  const params: Record<string, string | number> = {
    TerminalKey: cfg.terminalKey,
    Amount: amountKopecks,
    OrderId: orderId,
    Description: `Заказ ${group.publicCode} (предоплата, ${group.bookings.length} объ.)`,
    SuccessURL: `${env.APP_URL}/booking/success?group=${group.publicCode}`,
    FailURL: `${env.APP_URL}/booking/failed?group=${group.publicCode}`,
    NotificationURL: `${env.APP_URL}/api/payments/tinkoff/webhook`,
  };
  const Token = signTinkoff(params, cfg.password);

  // Позиция на каждую бронь; сумма позиций == amountKopecks (prepaymentAmount группы).
  const Receipt = makeReceipt(
    group.bookings.map((b) => ({
      name: `Предоплата за бронь ${b.publicCode} — ${b.object.name}`,
      amountKopecks: Math.round(Number(b.prepaymentAmount) * 100),
    })),
    group.guestEmail,
    group.guestPhone,
  );

  const res = await fetch(`${cfg.apiUrl}/Init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, Token, Receipt }),
  });
  const data = (await res.json()) as TinkoffInitResponse;

  if (!data.Success || !data.PaymentURL || !data.PaymentId) {
    throw new Error(`Tinkoff Init failed: ${data.Message || data.ErrorCode}`);
  }

  await prisma.payment.upsert({
    where: { groupId },
    create: {
      groupId,
      provider: cfg.mode === "test" ? "tinkoff-test" : "tinkoff",
      externalId: data.PaymentId,
      amount: payAmount,
      currency: "RUB",
      status: "PENDING",
      confirmationUrl: data.PaymentURL,
    },
    update: {
      externalId: data.PaymentId,
      amount: payAmount,
      confirmationUrl: data.PaymentURL,
      status: "PENDING",
    },
  });

  return { confirmationUrl: data.PaymentURL, paymentId: data.PaymentId };
}

export async function verifyTinkoffWebhook(
  payload: Record<string, unknown>,
): Promise<boolean> {
  const cfg = await getTinkoffConfig();
  if (!cfg.password) return false;
  const filtered: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (k === "Token") continue;
    if (typeof v === "object" && v !== null) continue;
    filtered[k] = v as string | number | boolean;
  }
  const expected = signTinkoff(filtered, cfg.password);
  return expected === payload.Token;
}

// Помечает успешную оплату: payment=SUCCEEDED и все связанные брони PAID
// (одиночную бронь ИЛИ всю группу — атомарно).
async function settleSuccess(
  payment: { id: string; bookingId: string | null; groupId: string | null },
  rawPayload?: unknown,
) {
  const now = new Date();
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        paidAt: now,
        ...(rawPayload !== undefined ? { rawPayload: rawPayload as object } : {}),
      },
    }),
  ];
  if (payment.groupId) {
    ops.push(
      prisma.bookingGroup.update({
        where: { id: payment.groupId },
        data: { status: "PAID", paidAt: now },
      }),
      prisma.booking.updateMany({
        where: { groupId: payment.groupId, status: "PENDING" },
        data: { status: "PAID", paidAt: now },
      }),
    );
  } else if (payment.bookingId) {
    ops.push(
      prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: "PAID", paidAt: now },
      }),
    );
  }
  await prisma.$transaction(ops);
}

export async function applyPaymentResult(args: {
  externalId: string;
  succeeded: boolean;
  rawPayload?: unknown;
}) {
  const payment = await prisma.payment.findFirst({
    where: { externalId: args.externalId },
  });
  if (!payment) return null;

  if (args.succeeded) {
    await settleSuccess(payment, args.rawPayload);
  } else {
    // Неуспех по вебхуку: помечаем только платёж (бронь остаётся PENDING — клиент
    // может повторить оплату до истечения срока).
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", rawPayload: args.rawPayload as object },
    });
  }
  // Возвращаем привязку платежа, чтобы вызывающий мог разослать уведомления.
  return {
    bookingId: payment.bookingId,
    groupId: payment.groupId,
    succeeded: args.succeeded,
  };
}

interface TinkoffCancelResponse {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  Status?: string;
  OriginalAmount?: number;
  NewAmount?: number;
  PaymentId?: string;
}

/**
 * Возврат средств клиенту. Делает полный возврат за платёж брони.
 * - mock: помечает payment=REFUNDED, booking=CANCELLED локально (без HTTP).
 * - real: вызывает Tinkoff Cancel (REFUNDED после settlement / REVERSED до).
 *
 * Бронь после возврата уходит в CANCELLED. Возврат возможен только из
 * SUCCEEDED (если не оплачено — отменять можно обычным «Отменить»).
 */
export async function refundPayment(bookingId: string): Promise<{
  refundedAmount: number;
  tinkoffStatus?: string;
  mock: boolean;
}> {
  const payment = await prisma.payment.findUnique({
    where: { bookingId },
    include: { booking: true },
  });
  if (!payment) throw new Error("Платёж не найден");
  if (payment.status !== "SUCCEEDED") {
    throw new Error(
      `Возврат доступен только для оплаченных платежей (текущий статус: ${payment.status})`,
    );
  }

  const amountRub = Number(payment.amount);
  const amountKopecks = Math.round(amountRub * 100);

  const isMockPayment = payment.provider === "tinkoff-mock";
  const cfg = await getTinkoffConfig();

  // Mock: и если конфиг в mock-режиме, и если сам платёж был создан в mock.
  if (isMockPayment || cfg.mode === "mock") {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "REFUNDED",
          rawPayload: { mock: true, refundedAt: new Date().toISOString() } as object,
        },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "CANCELLED",
          cancelReason: "Возврат средств",
          cancelledAt: new Date(),
        },
      }),
    ]);
    return { refundedAmount: amountRub, mock: true };
  }

  if (!cfg.terminalKey || !cfg.password) {
    throw new Error("Tinkoff не настроен: задайте TerminalKey и Password в админке");
  }
  if (!payment.externalId) {
    throw new Error("Нет PaymentId в Tinkoff — возврат невозможен");
  }

  const params: Record<string, string | number> = {
    TerminalKey: cfg.terminalKey,
    PaymentId: payment.externalId,
    Amount: amountKopecks,
  };
  const Token = signTinkoff(params, cfg.password);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let data: TinkoffCancelResponse;
  try {
    const res = await fetch(`${cfg.apiUrl}/Cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, Token }),
      signal: controller.signal,
    });
    data = (await res.json()) as TinkoffCancelResponse;
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    throw new Error(
      aborted ? "Tinkoff не ответил за 15 секунд" : `Tinkoff недоступен: ${String(e)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!data.Success) {
    throw new Error(`Tinkoff Cancel failed: ${data.Message || data.ErrorCode || "unknown"}`);
  }

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        rawPayload: data as unknown as object,
      },
    }),
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CANCELLED",
        cancelReason: "Возврат средств",
        cancelledAt: new Date(),
      },
    }),
  ]);

  return {
    refundedAmount: amountRub,
    tinkoffStatus: data.Status,
    mock: false,
  };
}

// Отмена всех броней группы + самой группы (без возврата денег) — для неоплаченных.
export async function cancelGroup(groupId: string, reason = "Отменён администратором") {
  const now = new Date();
  await prisma.$transaction([
    prisma.bookingGroup.update({
      where: { id: groupId },
      data: { status: "CANCELLED", cancelledAt: now },
    }),
    prisma.booking.updateMany({
      where: { groupId, status: { in: ["PENDING", "PAID"] } },
      data: { status: "CANCELLED", cancelReason: reason, cancelledAt: now },
    }),
    prisma.payment.updateMany({
      where: { groupId, status: "PENDING" },
      data: { status: "CANCELED" },
    }),
  ]);
}

/**
 * Возврат средств по групповому заказу: один платёж Tinkoff на всю группу,
 * затем все брони и группа → CANCELLED, платёж → REFUNDED.
 */
export async function refundGroupPayment(groupId: string): Promise<{
  refundedAmount: number;
  tinkoffStatus?: string;
  mock: boolean;
}> {
  const payment = await prisma.payment.findUnique({ where: { groupId } });
  if (!payment) throw new Error("Платёж по заказу не найден");
  if (payment.status !== "SUCCEEDED") {
    throw new Error(
      `Возврат доступен только для оплаченных заказов (текущий статус: ${payment.status})`,
    );
  }

  const amountRub = Number(payment.amount);
  const amountKopecks = Math.round(amountRub * 100);
  const isMockPayment = payment.provider === "tinkoff-mock";
  const cfg = await getTinkoffConfig();

  const finalize = (rawPayload: object) =>
    prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "REFUNDED", rawPayload },
      }),
      prisma.bookingGroup.update({
        where: { id: groupId },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      }),
      prisma.booking.updateMany({
        where: { groupId, status: { in: ["PENDING", "PAID"] } },
        data: { status: "CANCELLED", cancelReason: "Возврат средств", cancelledAt: new Date() },
      }),
    ]);

  if (isMockPayment || cfg.mode === "mock") {
    await finalize({ mock: true, refundedAt: new Date().toISOString() });
    return { refundedAmount: amountRub, mock: true };
  }

  if (!cfg.terminalKey || !cfg.password) {
    throw new Error("Tinkoff не настроен: задайте TerminalKey и Password в админке");
  }
  if (!payment.externalId) {
    throw new Error("Нет PaymentId в Tinkoff — возврат невозможен");
  }

  const params: Record<string, string | number> = {
    TerminalKey: cfg.terminalKey,
    PaymentId: payment.externalId,
    Amount: amountKopecks,
  };
  const Token = signTinkoff(params, cfg.password);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let data: TinkoffCancelResponse;
  try {
    const res = await fetch(`${cfg.apiUrl}/Cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, Token }),
      signal: controller.signal,
    });
    data = (await res.json()) as TinkoffCancelResponse;
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    throw new Error(
      aborted ? "Tinkoff не ответил за 15 секунд" : `Tinkoff недоступен: ${String(e)}`,
    );
  } finally {
    clearTimeout(timeout);
  }

  if (!data.Success) {
    throw new Error(`Tinkoff Cancel failed: ${data.Message || data.ErrorCode || "unknown"}`);
  }

  await finalize(data as unknown as object);
  return { refundedAmount: amountRub, tinkoffStatus: data.Status, mock: false };
}

export async function applyMockPayment(bookingId: string, succeeded: boolean) {
  const payment = await prisma.payment.findUnique({
    where: { bookingId },
    include: { booking: true },
  });
  if (!payment || !payment.booking) throw new Error("Платёж не найден");
  if (payment.booking.status !== "PENDING") return;

  if (succeeded) {
    await settleSuccess(payment);
  } else {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "CANCELED" },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: "CANCELLED",
          cancelReason: "Отказ от оплаты (mock)",
          cancelledAt: new Date(),
        },
      }),
    ]);
  }
}

// Mock-подтверждение оплаты для группы: успех → вся группа PAID;
// отказ → платёж CANCELED, все брони и группа CANCELLED.
export async function applyMockPaymentForGroup(groupId: string, succeeded: boolean) {
  const payment = await prisma.payment.findUnique({
    where: { groupId },
    include: { group: true },
  });
  if (!payment || !payment.group) throw new Error("Платёж не найден");
  if (payment.group.status !== "PENDING") return;

  if (succeeded) {
    await settleSuccess(payment);
  } else {
    const now = new Date();
    await prisma.$transaction([
      prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELED" } }),
      prisma.bookingGroup.update({
        where: { id: groupId },
        data: { status: "CANCELLED", cancelledAt: now },
      }),
      prisma.booking.updateMany({
        where: { groupId, status: "PENDING" },
        data: { status: "CANCELLED", cancelReason: "Отказ от оплаты (mock)", cancelledAt: now },
      }),
    ]);
  }
}
