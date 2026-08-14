import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof ZodError) {
    return fail("Ошибка валидации", 400, err.flatten());
  }
  if (err instanceof Error) {
    if (err.name === "BookingConflictError") {
      return fail(err.message, 409);
    }
    if (err.name === "ObjectNotAvailableError") {
      return fail(err.message, 410);
    }
    if (err.name === "PaymentProviderError") {
      return fail(err.message, 502);
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
