import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";

// Переключает отметку «разобрано» у записи ошибки (toggle).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const current = await prisma.serverErrorLog.findUnique({
      where: { id },
      select: { resolvedAt: true },
    });
    if (!current) return ok({ error: "Не найдено" }, 404);
    const updated = await prisma.serverErrorLog.update({
      where: { id },
      data: { resolvedAt: current.resolvedAt ? null : new Date() },
      select: { id: true, resolvedAt: true },
    });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
