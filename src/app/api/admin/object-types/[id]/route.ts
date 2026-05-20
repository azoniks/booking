import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { objectTypeUpdateSchema } from "@/lib/validators";
import { isEmptyRichText, sanitizeRichText } from "@/lib/sanitize";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const body = objectTypeUpdateSchema.parse(await req.json());
    if (typeof body.description === "string") {
      body.description = isEmptyRichText(body.description)
        ? null
        : sanitizeRichText(body.description);
    }
    const updated = await prisma.objectType.update({ where: { id }, data: body });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const objs = await prisma.bookingObject.count({ where: { objectTypeId: id } });
    if (objs > 0) return fail("Сначала удалите объекты этого типа", 400);
    await prisma.objectType.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}
