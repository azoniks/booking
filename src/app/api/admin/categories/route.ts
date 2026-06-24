import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { categoryCreateSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function GET() {
  if (!(await requireAdmin())) return unauth();
  const items = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { objectTypes: true } } },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const body = categoryCreateSchema.parse(await req.json());
    const slug = body.slug || slugify(body.name) || `cat-${Date.now()}`;
    const exists = await prisma.category.findUnique({ where: { slug } });
    if (exists) return fail("Категория с таким slug уже существует", 409);
    const created = await prisma.category.create({ data: { ...body, slug } });
    await recordAudit({
      actor: actorFromSession(session),
      action: "CREATE",
      entity: "CATEGORY",
      entityId: created.id,
      summary: `Создал категорию «${created.name}»`,
      ip: getClientIp(req.headers),
    });
    return ok(created, 201);
  } catch (e) {
    return handleError(e, { req, action: "Создание категории" });
  }
}
