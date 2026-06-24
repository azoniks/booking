import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { recordServerError, isUnexpectedError, extractEndpoint } from "@/lib/server-errors";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

// ctx — опциональный контекст попытки: req (для метода/пути), action (что
// пытались сделать) и context (детали: какой объект, гость и т.п.).
export async function handleError(
  err: unknown,
  ctx?: { req?: Request; action?: string; context?: unknown },
) {
  if (err instanceof ZodError) {
    // Показываем, какие поля не прошли — иначе на форме «Ошибка валидации» без причины.
    const fields = [
      ...new Set(err.issues.map((i) => i.path.join(".")).filter(Boolean)),
    ].join(", ");
    return fail(fields ? `Ошибка валидации: ${fields}` : "Ошибка валидации", 400, err.flatten());
  }

  // Реальный сбой (не валидация, не бизнес-ошибка) — фиксируем в лог ошибок.
  if (isUnexpectedError(err)) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : null;
    let method: string | null = null;
    let path: string | null = extractEndpoint(stack);
    if (ctx?.req) {
      try {
        method = ctx.req.method;
        path = new URL(ctx.req.url).pathname;
      } catch {
        // нестандартный req — оставляем путь из стека
      }
    }
    await recordServerError({
      source: "API",
      statusCode: err instanceof Error ? 400 : 500,
      message,
      stack,
      method,
      path,
      action: ctx?.action ?? null,
      context: ctx?.context,
    });
  }

  if (err instanceof Error) {
    if (err.name === "BookingConflictError") {
      return fail(err.message, 409);
    }
    if (err.name === "ObjectNotAvailableError") {
      return fail(err.message, 410);
    }
    return fail(err.message, 400);
  }
  return fail("Внутренняя ошибка", 500);
}

export async function requireAdmin() {
  const session = await auth();
  if (!session) {
    return null;
  }
  return session;
}

export function unauth() {
  return fail("Не авторизован", 401);
}
