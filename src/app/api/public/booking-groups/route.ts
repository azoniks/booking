import { NextRequest, NextResponse } from "next/server";
import { ok, handleError } from "@/lib/api-utils";
import { publicBookingGroupSchema } from "@/lib/validators";
import { createBookingGroup } from "@/lib/booking-service";
import { initGroupPayment } from "@/lib/tinkoff";
import { sendNewBookingGroupNotifications } from "@/lib/notifications/email";
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
  console.log(`[booking-group ${reqId}] start`);
  try {
    const ip = getClientIp(req.headers);

    const { max, windowMs } = await withTimeout(
      getBookingRateLimitConfig(),
      5_000,
      "getBookingRateLimitConfig",
    );
    const rl = checkBookingRateLimit(ip, max, windowMs);
    if (rl.blocked) {
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

    const captcha = await withTimeout(
      getCaptchaStatusForIp(ip),
      5_000,
      "getCaptchaStatusForIp",
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

    const { items, ...guest } = publicBookingGroupSchema.parse(payload);
    console.log(`[booking-group ${reqId}] schema ok, items=${items.length}, creating…`);

    const group = await withTimeout(
      createBookingGroup(items, guest),
      20_000,
      "createBookingGroup",
    );
    console.log(`[booking-group ${reqId}] group created id=${group.id}`);

    const payment = await withTimeout(initGroupPayment(group.id), 15_000, "initGroupPayment");
    console.log(`[booking-group ${reqId}] payment url=${payment.confirmationUrl}`);

    sendNewBookingGroupNotifications(group.id).catch((e) =>
      console.error(`[booking-group ${reqId}] notify failed:`, e),
    );

    return ok({
      groupId: group.id,
      groupCode: group.publicCode,
      confirmationUrl: payment.confirmationUrl,
    });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("timeout:")) {
      const stage = e.message.slice("timeout:".length);
      console.error(`[booking-group ${reqId}] TIMEOUT at stage=${stage}`);
      return NextResponse.json(
        { ok: false, error: `Внутренний таймаут (${stage}). Попробуйте ещё раз.` },
        { status: 504 },
      );
    }
    console.error(`[booking-group ${reqId}] error:`, e);
    return handleError(e);
  }
}
