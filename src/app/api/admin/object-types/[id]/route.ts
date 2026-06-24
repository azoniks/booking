import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { objectTypeUpdateSchema } from "@/lib/validators";
import { isEmptyRichText, sanitizeRichText } from "@/lib/sanitize";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const body = objectTypeUpdateSchema.parse(await req.json());
    if (typeof body.description === "string") {
      body.description = isEmptyRichText(body.description)
        ? null
        : sanitizeRichText(body.description);
    }
    const updated = await prisma.objectType.update({ where: { id }, data: body });
    await recordAudit({
      actor: actorFromSession(session),
      action: "UPDATE",
      entity: "OBJECT_TYPE",
      entityId: id,
      summary: `Изменил тип объекта «${updated.name}»`,
      ip: getClientIp(req.headers),
    });
    return ok(updated);
  } catch (e) {
    return handleError(e, { req, action: "Изменение типа объекта" });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const objs = await prisma.bookingObject.count({ where: { objectTypeId: id } });
    if (objs > 0) return fail("Сначала удалите объекты этого типа", 400);
    const existing = await prisma.objectType.findUnique({
      where: { id },
      select: { name: true },
    });
    await prisma.objectType.delete({ where: { id } });
    await recordAudit({
      actor: actorFromSession(session),
      action: "DELETE",
      entity: "OBJECT_TYPE",
      entityId: id,
      summary: `Удалил тип объекта «${existing?.name ?? id}»`,
      ip: getClientIp(req.headers),
    });
    return ok({ id });
  } catch (e) {
    return handleError(e, { req, action: "Удаление типа объекта" });
  }
}
