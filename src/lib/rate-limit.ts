type RateLimitState = {
  failures: number;
  windowStart: number;
  blockedUntil: number;
};

const WINDOW_MS = 10 * 60 * 1000;
const BLOCK_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_KEYS = 10_000;

const store = new Map<string, RateLimitState>();

function evictIfNeeded() {
  if (store.size <= MAX_KEYS) return;
  const now = Date.now();
  for (const [k, v] of store) {
    if (v.blockedUntil <= now && v.windowStart + WINDOW_MS <= now) {
      store.delete(k);
    }
  }
}

export function checkLoginRateLimit(key: string): {
  blocked: boolean;
  retryAfterSec: number;
} {
  const now = Date.now();
  const s = store.get(key);
  if (!s) return { blocked: false, retryAfterSec: 0 };
  if (s.blockedUntil > now) {
    return { blocked: true, retryAfterSec: Math.ceil((s.blockedUntil - now) / 1000) };
  }
  return { blocked: false, retryAfterSec: 0 };
}

export function recordLoginFailure(key: string): {
  blocked: boolean;
  retryAfterSec: number;
  failures: number;
} {
  const now = Date.now();
  let s = store.get(key);
  if (!s || s.windowStart + WINDOW_MS <= now) {
    s = { failures: 0, windowStart: now, blockedUntil: 0 };
  }
  s.failures += 1;
  if (s.failures >= MAX_FAILURES) {
    s.blockedUntil = now + BLOCK_MS;
  }
  store.set(key, s);
  evictIfNeeded();
  return {
    blocked: s.blockedUntil > now,
    retryAfterSec: s.blockedUntil > now ? Math.ceil((s.blockedUntil - now) / 1000) : 0,
    failures: s.failures,
  };
}

export function clearLoginRateLimit(key: string) {
  store.delete(key);
}

const slidingLogs = new Map<string, number[]>();

function pruneSliding(now: number) {
  if (slidingLogs.size <= MAX_KEYS) return;
  for (const [k, log] of slidingLogs) {
    if (log.length === 0 || log[log.length - 1] < now - 24 * 60 * 60 * 1000) {
      slidingLogs.delete(k);
    }
  }
}

export function checkSlidingRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { blocked: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  const cutoff = now - windowMs;
  const log = (slidingLogs.get(key) || []).filter((t) => t > cutoff);
  if (log.length !== (slidingLogs.get(key)?.length ?? 0)) {
    slidingLogs.set(key, log);
  }
  if (log.length >= limit) {
    const oldest = log[0];
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      remaining: 0,
    };
  }
  return { blocked: false, retryAfterSec: 0, remaining: limit - log.length };
}

export function recordSlidingHit(key: string, windowMs: number) {
  const now = Date.now();
  const cutoff = now - windowMs;
  const log = (slidingLogs.get(key) || []).filter((t) => t > cutoff);
  log.push(now);
  slidingLogs.set(key, log);
  pruneSliding(now);
}

import { prisma } from "./db";

export const BOOKING_RATE_LIMIT_DEFAULTS = { max: 5, windowMin: 60 };
const CONFIG_CACHE_TTL_MS = 30_000;
let bookingConfigCache:
  | { max: number; windowMs: number; expiresAt: number }
  | null = null;

async function readSettingNumber(key: string): Promise<number | null> {
  const s = await prisma.settings.findUnique({ where: { key } });
  if (s?.value === undefined || s.value === null) return null;
  const v = Number(s.value);
  return Number.isFinite(v) ? v : null;
}

export async function getBookingRateLimitConfig(): Promise<{
  max: number;
  windowMs: number;
  windowMin: number;
}> {
  const now = Date.now();
  if (bookingConfigCache && bookingConfigCache.expiresAt > now) {
    return {
      max: bookingConfigCache.max,
      windowMs: bookingConfigCache.windowMs,
      windowMin: Math.round(bookingConfigCache.windowMs / 60_000),
    };
  }
  const [maxVal, windowVal] = await Promise.all([
    readSettingNumber("bookingRateLimitMax"),
    readSettingNumber("bookingRateLimitWindowMin"),
  ]);
  const max =
    maxVal !== null && maxVal >= 1
      ? Math.floor(maxVal)
      : BOOKING_RATE_LIMIT_DEFAULTS.max;
  const windowMin =
    windowVal !== null && windowVal >= 1
      ? Math.floor(windowVal)
      : BOOKING_RATE_LIMIT_DEFAULTS.windowMin;
  const windowMs = windowMin * 60_000;
  bookingConfigCache = { max, windowMs, expiresAt: now + CONFIG_CACHE_TTL_MS };
  return { max, windowMs, windowMin };
}

export function invalidateBookingRateLimitCache() {
  bookingConfigCache = null;
}

export function checkBookingRateLimit(ip: string, limit: number, windowMs: number) {
  return checkSlidingRateLimit(`booking:${ip}`, limit, windowMs);
}

export function recordBookingAttempt(ip: string, windowMs: number) {
  recordSlidingHit(`booking:${ip}`, windowMs);
}

export function countRecentBookingAttempts(ip: string, windowMs: number): number {
  const now = Date.now();
  const cutoff = now - windowMs;
  const log = (slidingLogs.get(`booking:${ip}`) || []).filter((t) => t > cutoff);
  return log.length;
}

export function getClientIp(headers: Headers | undefined | null): string {
  if (!headers) return "unknown";
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
