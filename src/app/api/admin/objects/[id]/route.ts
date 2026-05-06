import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { objectUpdateSchema } from "@/lib/validators";

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
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const body = objectUpdateSchema.parse(await req.json());
    const updated = await prisma.bookingObject.update({ where: { id }, data: body });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    await prisma.bookingObject.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}
