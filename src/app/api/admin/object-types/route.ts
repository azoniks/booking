import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { objectTypeCreateSchema } from "@/lib/validators";
import { isEmptyRichText, sanitizeRichText } from "@/lib/sanitize";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function GET() {
  if (!(await requireAdmin())) return unauth();
  const items = await prisma.objectType.findMany({
    orderBy: [{ name: "asc" }],
    include: { category: true, _count: { select: { objects: true } } },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const body = objectTypeCreateSchema.parse(await req.json());
    if (typeof body.description === "string") {
      body.description = isEmptyRichText(body.description)
        ? null
        : sanitizeRichText(body.description);
    }
    const created = await prisma.objectType.create({ data: body });
    await recordAudit({
      actor: actorFromSession(session),
      action: "CREATE",
      entity: "OBJECT_TYPE",
      entityId: created.id,
      summary: `Создал тип объекта «${created.name}»`,
      ip: getClientIp(req.headers),
    });
    return ok(created, 201);
  } catch (e) {
    return handleError(e, { req, action: "Создание типа объекта" });
  }
}
