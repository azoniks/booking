import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { slotCreateSchema } from "@/lib/validators";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  const { id } = await params;
  const items = await prisma.objectTypeSlot.findMany({
    where: { objectTypeId: id },
    orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
  });
  return ok(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const exists = await prisma.objectType.findUnique({ where: { id } });
    if (!exists) return fail("Тип не найден", 404);
    const body = slotCreateSchema.parse(await req.json());
    const created = await prisma.objectTypeSlot.create({
      data: { ...body, objectTypeId: id },
    });
    await recordAudit({
      actor: actorFromSession(session),
      action: "CREATE",
      entity: "SLOT",
      entityId: created.id,
      summary: `Создал слот «${created.name}» (${created.startTime}–${created.endTime}) для типа «${exists.name}»`,
      ip: getClientIp(req.headers),
    });
    return ok(created, 201);
  } catch (e) {
    return handleError(e, { req, action: "Создание слота" });
  }
}
