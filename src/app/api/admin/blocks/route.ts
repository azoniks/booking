import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { blockCreateSchema } from "@/lib/validators";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";
import { formatLocal } from "@/lib/time";

export async function GET() {
  if (!(await requireAdmin())) return unauth();
  const items = await prisma.objectBlock.findMany({
    orderBy: { startAt: "asc" },
    include: { object: true },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const body = blockCreateSchema.parse(await req.json());
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    const created = await prisma.objectBlock.createMany({
      data: body.objectIds.map((objectId) => ({
        objectId,
        startAt,
        endAt,
        reason: body.reason || null,
      })),
    });
    await recordAudit({
      actor: actorFromSession(session),
      action: "CREATE",
      entity: "BLOCK",
      summary: `Создал блокировку (${formatLocal(startAt)} — ${formatLocal(endAt)}) для объектов: ${body.objectIds.length}`,
      meta: { objectIds: body.objectIds, reason: body.reason || null },
      ip: getClientIp(req.headers),
    });
    return ok({ count: created.count }, 201);
  } catch (e) {
    return handleError(e, { req, action: "Создание блокировки" });
  }
}
