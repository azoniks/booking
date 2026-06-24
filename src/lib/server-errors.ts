import { ZodError } from "zod";
import type { ErrorSource, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

// Ожидаемые доменные ошибки — это не «сбои», а штатные ответы (409/410).
const KNOWN_BUSINESS_ERRORS = new Set([
  "BookingConflictError",
  "ObjectNotAvailableError",
]);

/**
 * Реальный сбой? Валидация (ZodError) и бизнес-ошибки — ожидаемы, их не пишем.
 * Всё остальное (ошибки БД, внешних API, баги) считаем сбоем.
 */
export function isUnexpectedError(err: unknown): boolean {
  if (err instanceof ZodError) return false;
  if (err instanceof Error && KNOWN_BUSINESS_ERRORS.has(err.name)) return false;
  return true;
}

// Best-effort: вытащить из стека путь упавшей ручки API вида
// "/api/.../route.ts" — подсказка, что именно сломалось.
export function extractEndpoint(stack?: string | null): string | null {
  if (!stack) return null;
  const m = stack.match(/(\/api\/[^\s):]+route\.[tj]s)/);
  return m ? m[1] : null;
}

/**
 * Записывает сбой сервера. Никогда не бросает: если запись лога сама падает
 * (например, недоступна БД) — только console.error, без рекурсии.
 */
export async function recordServerError(input: {
  source: ErrorSource;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  action?: string | null;
  context?: unknown;
  message: string;
  stack?: string | null;
  digest?: string | null;
}): Promise<void> {
  try {
    await prisma.serverErrorLog.create({
      data: {
        source: input.source,
        method: input.method ?? null,
        path: input.path ?? null,
        statusCode: input.statusCode ?? null,
        action: input.action ?? null,
        context: toJson(input.context),
        // Ограничиваем размер, чтобы не раздувать строки.
        message: input.message.slice(0, 2000),
        stack: input.stack?.slice(0, 8000) ?? null,
        digest: input.digest ?? null,
      },
    });
  } catch (e) {
    console.error("[server-errors] не удалось записать сбой", e);
  }
}

// Приводит произвольное значение к JSON для Prisma Json-поля; undefined если
// нечего писать или сериализация невозможна.
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}
