import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { sendStatusChangeNotifications } from "@/lib/notifications/email";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["PENDING", "PAID", "CANCELLED", "COMPLETED", "NO_SHOW"]).optional(),
  cancelReason: z.string().max(500).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  const { id } = await params;
  const item = await prisma.booking.findUnique({
    where: { id },
    include: {
      object: { include: { objectType: { include: { category: true } } } },
      payment: true,
      notifications: { orderBy: { sentAt: "desc" } },
    },
  });
  if (!item) return fail("Не найдено", 404);
  return ok(item);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    await prisma.booking.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const data: Record<string, unknown> = { ...body };
    if (body.status === "CANCELLED") {
      data.cancelledAt = new Date();
    }
    if (body.status === "PAID") {
      data.paidAt = new Date();
    }
    const updated = await prisma.booking.update({ where: { id }, data });
    if (body.status) {
      sendStatusChangeNotifications(id, body.status).catch((e) =>
        console.error("[notify status]", e),
      );
    }
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}
