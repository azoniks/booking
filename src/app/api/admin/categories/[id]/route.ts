import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { categoryUpdateSchema } from "@/lib/validators";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const body = categoryUpdateSchema.parse(await req.json());
    const updated = await prisma.category.update({ where: { id }, data: body });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const types = await prisma.objectType.count({ where: { categoryId: id } });
    if (types > 0) return fail("Сначала удалите типы объектов в этой категории", 400);
    await prisma.category.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}
