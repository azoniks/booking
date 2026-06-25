// ВАЖНО: при структуре с папкой src/ этот файл должен лежать именно в src/
// (Next ищет src/instrumentation.ts). В корне проекта он игнорируется.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}

// Перехват непойманных серверных ошибок (рендер RSC/страниц и ручки, которые
// не ловят ошибку сами). Пойманные в роутах ошибки сюда не доходят — их пишет
// handleError. Только nodejs-рантайм (нужна БД); всё обёрнуто в try/catch.
export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: { routeType?: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordServerError } = await import("@/lib/server-errors");
    const e = err as { message?: string; stack?: string; digest?: string };
    await recordServerError({
      source: context?.routeType === "route" ? "API" : "RENDER",
      method: request?.method ?? null,
      path: request?.path ?? null,
      message: e?.message ? String(e.message) : String(err),
      stack: e?.stack ?? null,
      digest: e?.digest ?? null,
    });
  } catch (logErr) {
    console.error("[instrumentation] onRequestError logging failed", logErr);
  }
}
