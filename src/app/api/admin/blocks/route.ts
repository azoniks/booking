import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { blockCreateSchema } from "@/lib/validators";

export async function GET() {
  if (!(await requireAdmin())) return unauth();
  const items = await prisma.objectBlock.findMany({
    orderBy: { startAt: "asc" },
    include: { object: true },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const body = blockCreateSchema.parse(await req.json());
    const created = await prisma.objectBlock.create({
      data: {
        objectId: body.objectId,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
        reason: body.reason || null,
      },
    });
    return ok(created, 201);
  } catch (e) {
    return handleError(e);
  }
}
