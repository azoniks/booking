import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";

// Очистка лога ошибок. ?scope=resolved — удалить только разобранные;
// иначе удалить всё (требует ?confirm=1, чтобы не снести случайно).
export async function DELETE(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope");
    if (scope === "resolved") {
      const r = await prisma.serverErrorLog.deleteMany({
        where: { resolvedAt: { not: null } },
      });
      return ok({ deleted: r.count });
    }
    if (url.searchParams.get("confirm") !== "1") {
      return ok({ error: "confirm=1 required" }, 400);
    }
    const r = await prisma.serverErrorLog.deleteMany({});
    return ok({ deleted: r.count });
  } catch (e) {
    return handleError(e);
  }
}
