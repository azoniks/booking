import { createHash, createHmac } from "node:crypto";
import { prisma } from "./db";
import { env } from "./env";

interface TinkoffInitResponse {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  PaymentId?: string;
  PaymentURL?: string;
}

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

export async function initPayment(bookingId: string): Promise<{
  confirmationUrl: string;
  paymentId: string;
}> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new Error("Бронь не найдена");
  const payAmount = booking.prepaymentAmount;
  const amountKopecks = Math.round(Number(payAmount) * 100);

  const cfg = await getTinkoffConfig();

  // Mock-режим
  if (cfg.mode === "mock") {
    const url = `${env.APP_URL}/payments/mock?bookingId=${bookingId}&sig=${mockSign(bookingId)}`;
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

  const params: Record<string, string | number> = {
    TerminalKey: cfg.terminalKey,
    Amount: amountKopecks,
    OrderId: booking.publicCode,
    Description: `Бронь ${booking.publicCode} (предоплата)`,
    SuccessURL: `${env.APP_URL}/booking/success?code=${booking.publicCode}`,
    FailURL: `${env.APP_URL}/booking/failed?code=${booking.publicCode}`,
    NotificationURL: `${env.APP_URL}/api/payments/tinkoff/webhook`,
  };
  const Token = signTinkoff(params, cfg.password);

  const res = await fetch(`${cfg.apiUrl}/Init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, Token }),
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

export async function applyPaymentResult(args: {
  externalId: string;
  succeeded: boolean;
  rawPayload?: unknown;
}) {
  const payment = await prisma.payment.findFirst({
    where: { externalId: args.externalId },
    include: { booking: true },
  });
  if (!payment) return;

  if (args.succeeded) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "SUCCEEDED",
          paidAt: new Date(),
          rawPayload: args.rawPayload as object,
        },
      }),
      prisma.booking.update({
        where: { id: payment.bookingId },
        data: { status: "PAID", paidAt: new Date() },
      }),
    ]);
  } else {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", rawPayload: args.rawPayload as object },
    });
  }
}

export async function applyMockPayment(bookingId: string, succeeded: boolean) {
  const payment = await prisma.payment.findUnique({
    where: { bookingId },
    include: { booking: true },
  });
  if (!payment) throw new Error("Платёж не найден");
  if (payment.booking.status !== "PENDING") return;

  if (succeeded) {
    await prisma.$transaction([
      prisma.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCEEDED", paidAt: new Date() },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: { status: "PAID", paidAt: new Date() },
      }),
    ]);
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
