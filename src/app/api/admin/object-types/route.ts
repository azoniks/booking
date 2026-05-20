import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { objectTypeCreateSchema } from "@/lib/validators";
import { isEmptyRichText, sanitizeRichText } from "@/lib/sanitize";

export async function GET() {
  if (!(await requireAdmin())) return unauth();
  const items = await prisma.objectType.findMany({
    orderBy: [{ name: "asc" }],
    include: { category: true, _count: { select: { objects: true } } },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const body = objectTypeCreateSchema.parse(await req.json());
    if (typeof body.description === "string") {
      body.description = isEmptyRichText(body.description)
        ? null
        : sanitizeRichText(body.description);
    }
    const created = await prisma.objectType.create({ data: body });
    return ok(created, 201);
  } catch (e) {
    return handleError(e);
  }
}
