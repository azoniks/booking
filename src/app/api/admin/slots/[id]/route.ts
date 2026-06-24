import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { slotUpdateSchema } from "@/lib/validators";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const body = slotUpdateSchema.parse(await req.json());
    const updated = await prisma.objectTypeSlot.update({ where: { id }, data: body });
    await recordAudit({
      actor: actorFromSession(session),
      action: "UPDATE",
      entity: "SLOT",
      entityId: id,
      summary: `Изменил слот «${updated.name}» (${updated.startTime}–${updated.endTime})`,
      ip: getClientIp(req.headers),
    });
    return ok(updated);
  } catch (e) {
    return handleError(e, { req, action: "Изменение слота" });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const existing = await prisma.objectTypeSlot.findUnique({
      where: { id },
      select: { name: true },
    });
    await prisma.objectTypeSlot.delete({ where: { id } });
    await recordAudit({
      actor: actorFromSession(session),
      action: "DELETE",
      entity: "SLOT",
      entityId: id,
      summary: `Удалил слот «${existing?.name ?? id}»`,
      ip: getClientIp(req.headers),
    });
    return ok({ id });
  } catch (e) {
    return handleError(e, { req, action: "Удаление слота" });
  }
}
