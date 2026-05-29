import { prisma } from "./db";
import {
  countRecentBookingAttempts,
  getBookingRateLimitConfig,
} from "./rate-limit";

export const CAPTCHA_DEFAULTS = { softThreshold: 3 };
const CACHE_TTL_MS = 30_000;
const VALIDATE_URL = "https://smartcaptcha.yandexcloud.net/validate";

type CaptchaConfig = {
  enabled: boolean;
  clientKey: string;
  serverKey: string;
  softThreshold: number;
};

let cache: (CaptchaConfig & { expiresAt: number }) | null = null;

export async function getCaptchaConfig(): Promise<CaptchaConfig> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    const { expiresAt: _unused, ...rest } = cache;
    void _unused;
    return rest;
  }
  const items = await prisma.settings.findMany({
    where: {
      key: {
        in: [
          "yandexCaptchaEnabled",
          "yandexCaptchaClientKey",
          "yandexCaptchaServerKey",
          "yandexCaptchaSoftThreshold",
        ],
      },
    },
  });
  const map: Record<string, unknown> = {};
  for (const i of items) map[i.key] = i.value;

  const enabledRaw = map.yandexCaptchaEnabled;
  const enabled = enabledRaw === "true" || enabledRaw === true;
  const clientKey = String(map.yandexCaptchaClientKey ?? "").trim();
  const serverKey = String(map.yandexCaptchaServerKey ?? "").trim();
  const softN = Number(map.yandexCaptchaSoftThreshold ?? CAPTCHA_DEFAULTS.softThreshold);
  const softThreshold =
    Number.isFinite(softN) && softN >= 1
      ? Math.floor(softN)
      : CAPTCHA_DEFAULTS.softThreshold;

  const cfg: CaptchaConfig = { enabled, clientKey, serverKey, softThreshold };
  cache = { ...cfg, expiresAt: now + CACHE_TTL_MS };
  return cfg;
}

export function invalidateCaptchaConfigCache() {
  cache = null;
}

export async function getCaptchaStatusForIp(ip: string): Promise<{
  enabled: boolean;
  required: boolean;
  clientKey: string;
}> {
  const cfg = await getCaptchaConfig();
  if (!cfg.enabled || !cfg.clientKey || !cfg.serverKey) {
    console.log(
      `[captcha] disabled or not configured (enabled=${cfg.enabled} clientKey=${!!cfg.clientKey} serverKey=${!!cfg.serverKey})`,
    );
    return { enabled: false, required: false, clientKey: "" };
  }
  const { windowMs } = await getBookingRateLimitConfig();
  const count = countRecentBookingAttempts(ip, windowMs);
  const required = count >= cfg.softThreshold;
  console.log(
    `[captcha] ip=${ip} count=${count} threshold=${cfg.softThreshold} required=${required}`,
  );
  return {
    enabled: true,
    required,
    clientKey: cfg.clientKey,
  };
}

export async function verifyCaptchaToken(token: string, ip: string): Promise<boolean> {
  const cfg = await getCaptchaConfig();
  if (!cfg.serverKey) return false;
  const params = new URLSearchParams();
  params.set("secret", cfg.serverKey);
  params.set("token", token);
  if (ip && ip !== "unknown") params.set("ip", ip);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(VALIDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error("[captcha] validate non-200:", res.status);
      return false;
    }
    const j = (await res.json()) as { status?: string; message?: string };
    if (j.status !== "ok") {
      console.warn("[captcha] validate failed:", j.message ?? j.status);
    }
    return j.status === "ok";
  } catch (e) {
    console.error("[captcha] validate error:", e);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
