import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const existing = await prisma.objectBlock.findUnique({
      where: { id },
      select: { object: { select: { name: true } } },
    });
    await prisma.objectBlock.delete({ where: { id } });
    await recordAudit({
      actor: actorFromSession(session),
      action: "DELETE",
      entity: "BLOCK",
      entityId: id,
      summary: `Удалил блокировку${
        existing?.object?.name ? ` объекта «${existing.object.name}»` : ""
      }`,
      ip: getClientIp(req.headers),
    });
    return ok({ id });
  } catch (e) {
    return handleError(e, { req, action: "Удаление блокировки" });
  }
}
