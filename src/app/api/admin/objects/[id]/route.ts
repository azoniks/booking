import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { objectUpdateSchema } from "@/lib/validators";
import { isEmptyRichText, sanitizeRichText } from "@/lib/sanitize";
import { recordAudit, actorFromSession, changedFields } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  const { id } = await params;
  const obj = await prisma.bookingObject.findUnique({
    where: { id },
    include: {
      objectType: { include: { category: true } },
      media: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!obj) return ok(null, 404);
  return ok(obj);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const before = await prisma.bookingObject.findUnique({
      where: { id },
      select: { name: true, status: true, sortOrder: true, isAddon: true },
    });
    const { addonIds, ...body } = objectUpdateSchema.parse(await req.json());
    if (typeof body.description === "string") {
      body.description = isEmptyRichText(body.description)
        ? null
        : sanitizeRichText(body.description);
    }
    const updated = await prisma.bookingObject.update({
      where: { id },
      data: {
        ...body,
        // addonIds приходит только когда форма им управляет — иначе связь не трогаем.
        ...(addonIds ? { addons: { set: addonIds.map((aid) => ({ id: aid })) } } : {}),
      },
    });
    await recordAudit({
      actor: actorFromSession(session),
      action: "UPDATE",
      entity: "OBJECT",
      entityId: id,
      summary: `Изменил объект «${updated.name}»`,
      meta: {
        changed: before
          ? changedFields(before, updated, ["name", "status", "sortOrder", "isAddon"])
          : {},
        addonsChanged: !!addonIds,
      },
      ip: getClientIp(req.headers),
    });
    return ok(updated);
  } catch (e) {
    return handleError(e, { req, action: "Изменение объекта" });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const existing = await prisma.bookingObject.findUnique({
      where: { id },
      select: { name: true },
    });
    await prisma.bookingObject.delete({ where: { id } });
    await recordAudit({
      actor: actorFromSession(session),
      action: "DELETE",
      entity: "OBJECT",
      entityId: id,
      summary: `Удалил объект «${existing?.name ?? id}»`,
      ip: getClientIp(req.headers),
    });
    return ok({ id });
  } catch (e) {
    return handleError(e, { req, action: "Удаление объекта" });
  }
}
