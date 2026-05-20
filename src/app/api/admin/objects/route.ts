import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { objectCreateSchema } from "@/lib/validators";
import { slugify } from "@/lib/utils";
import { isEmptyRichText, sanitizeRichText } from "@/lib/sanitize";

export async function GET() {
  if (!(await requireAdmin())) return unauth();
  const items = await prisma.bookingObject.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      objectType: { include: { category: true } },
      _count: { select: { bookings: true, media: true } },
    },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const body = objectCreateSchema.parse(await req.json());
    if (typeof body.description === "string") {
      body.description = isEmptyRichText(body.description)
        ? null
        : sanitizeRichText(body.description);
    }
    const slug = body.slug || slugify(body.name) || `obj-${Date.now()}`;
    const exists = await prisma.bookingObject.findUnique({ where: { slug } });
    if (exists) return fail("Объект с таким slug уже существует", 409);
    const created = await prisma.bookingObject.create({ data: { ...body, slug } });
    return ok(created, 201);
  } catch (e) {
    return handleError(e);
  }
}
