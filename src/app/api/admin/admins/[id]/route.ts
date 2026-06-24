import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { adminUpdateSchema } from "@/lib/validators";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const body = adminUpdateSchema.parse(await req.json());
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);
    const updated = await prisma.adminUser.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, isActive: true, createdAt: true },
    });
    // Какие поля менялись — без значения пароля.
    const changed: string[] = [];
    if (body.name !== undefined) changed.push("имя");
    if (body.isActive !== undefined) changed.push(`активность=${body.isActive}`);
    if (body.password) changed.push("пароль");
    await recordAudit({
      actor: actorFromSession(session),
      action: "UPDATE",
      entity: "ADMIN",
      entityId: id,
      summary: `Изменил администратора ${updated.name} (${updated.email}): ${
        changed.join(", ") || "—"
      }`,
      ip: getClientIp(req.headers),
    });
    return ok(updated);
  } catch (e) {
    return handleError(e, { req, action: "Изменение администратора" });
  }
}
