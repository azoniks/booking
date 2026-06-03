import { NextRequest, NextResponse } from "next/server";
import { ok, handleError, fail } from "@/lib/api-utils";
import { publicBookingSchema } from "@/lib/validators";
import { createBooking } from "@/lib/booking-service";
import { initPayment } from "@/lib/tinkoff";
import { sendNewBookingNotifications } from "@/lib/notifications/email";
import { prisma } from "@/lib/db";
import {
  checkBookingRateLimit,
  getBookingRateLimitConfig,
  getClientIp,
  recordBookingAttempt,
} from "@/lib/rate-limit";
import { getCaptchaStatusForIp, verifyCaptchaToken } from "@/lib/captcha";

function formatRetry(sec: number): string {
  if (sec <= 60) return "минуту";
  const m = Math.ceil(sec / 60);
  if (m < 5) return `${m} минуты`;
  return `${m} минут`;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout:${label}`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export async function POST(req: NextRequest) {
  const reqId = Math.random().toString(36).slice(2, 8);
  console.log(`[booking ${reqId}] start`);
  try {
    const ip = getClientIp(req.headers);
    console.log(`[booking ${reqId}] ip=${ip}`);

    const { max, windowMs } = await withTimeout(
      getBookingRateLimitConfig(),
      5_000,
      "getBookingRateLimitConfig",
    );
    const rl = checkBookingRateLimit(ip, max, windowMs);
    if (rl.blocked) {
      console.log(`[booking ${reqId}] rate-limit blocked retryAfter=${rl.retryAfterSec}s`);
      return NextResponse.json(
        {
          ok: false,
          error: `Слишком много попыток бронирования. Повторите через ${formatRetry(rl.retryAfterSec)}.`,
        },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const raw = await req.json().catch(() => ({}));
    const { captchaToken, ...payload } = (raw ?? {}) as Record<string, unknown>;
    console.log(`[booking ${reqId}] body parsed`);

    const captcha = await withTimeout(
      getCaptchaStatusForIp(ip),
      5_000,
      "getCaptchaStatusForIp",
    );
    console.log(
      `[booking ${reqId}] captcha enabled=${captcha.enabled} required=${captcha.required}`,
    );
    if (captcha.required) {
      if (typeof captchaToken !== "string" || !captchaToken) {
        return NextResponse.json(
          {
            ok: false,
            error: "Подтвердите, что вы не робот, и отправьте форму снова.",
            captchaRequired: true,
            siteKey: captcha.clientKey,
          },
          { status: 400 },
        );
      }
      const verified = await withTimeout(
        verifyCaptchaToken(captchaToken, ip),
        12_000,
        "verifyCaptchaToken",
      );
      console.log(`[booking ${reqId}] captcha verified=${verified}`);
      if (!verified) {
        return NextResponse.json(
          {
            ok: false,
            error: "Проверка капчи не пройдена. Попробуйте ещё раз.",
            captchaRequired: true,
            siteKey: captcha.clientKey,
          },
          { status: 400 },
        );
      }
    }

    recordBookingAttempt(ip, windowMs);

    const data = publicBookingSchema.parse(payload);
    console.log(`[booking ${reqId}] schema ok, creating booking…`);

    // Объект-аддон нельзя бронировать в одиночку — только в составе заказа с родителем.
    const objMeta = await prisma.bookingObject.findUnique({
      where: { id: data.objectId },
      select: { isAddon: true },
    });
    if (objMeta?.isAddon) {
      return NextResponse.json(
        { ok: false, error: "Этот объект бронируется только вместе с основным (например, мостиком)." },
        { status: 400 },
      );
    }

    const booking = await withTimeout(createBooking(data), 15_000, "createBooking");
    console.log(`[booking ${reqId}] booking created id=${booking.id}`);

    const payment = await withTimeout(initPayment(booking.id), 15_000, "initPayment");
    console.log(`[booking ${reqId}] payment initiated url=${payment.confirmationUrl}`);

    sendNewBookingNotifications(booking.id).catch((e) =>
      console.error(`[booking ${reqId}] notify failed:`, e),
    );

    return ok({
      bookingId: booking.id,
      publicCode: booking.publicCode,
      confirmationUrl: payment.confirmationUrl,
    });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("timeout:")) {
      const stage = e.message.slice("timeout:".length);
      console.error(`[booking ${reqId}] TIMEOUT at stage=${stage}`);
      return NextResponse.json(
        { ok: false, error: `Внутренний таймаут (${stage}). Попробуйте ещё раз.` },
        { status: 504 },
      );
    }
    console.error(`[booking ${reqId}] error:`, e);
    return handleError(e);
  }
}

// получение брони по publicCode (для success страницы)
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) return fail("code required", 400);
    const b = await prisma.booking.findUnique({
      where: { publicCode: code },
      include: { object: { include: { objectType: { include: { category: true } } } } },
    });
    return ok(b);
  } catch (e) {
    return handleError(e);
  }
}
