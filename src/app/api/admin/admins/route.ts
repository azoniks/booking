import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { adminCreateSchema } from "@/lib/validators";

export async function GET() {
  if (!(await requireAdmin())) return unauth();
  const items = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
  return ok(items);
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const body = adminCreateSchema.parse(await req.json());
    const exists = await prisma.adminUser.findUnique({ where: { email: body.email.toLowerCase() } });
    if (exists) return fail("Email уже занят", 409);
    const passwordHash = await bcrypt.hash(body.password, 10);
    const user = await prisma.adminUser.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash,
      },
      select: { id: true, email: true, name: true, isActive: true, createdAt: true },
    });
    return ok(user, 201);
  } catch (e) {
    return handleError(e);
  }
}
