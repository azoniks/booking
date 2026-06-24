import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

const patchSchema = z.object({
  status: z.enum(["PENDING", "PREPAID", "PAID", "CANCELLED"]),
});

// Смена статуса оплаты заказа: меняет статус группы и всех её броней атомарно.
// paidAt выставляется только при полной оплате (PAID).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const { status } = patchSchema.parse(await req.json());
    const group = await prisma.bookingGroup.findUnique({
      where: { id },
      select: { publicCode: true, status: true },
    });
    const paidAt = status === "PAID" ? new Date() : null;
    const cancelledAt = status === "CANCELLED" ? new Date() : null;
    await prisma.$transaction([
      prisma.bookingGroup.update({
        where: { id },
        data: { status, ...(paidAt ? { paidAt } : {}), ...(cancelledAt ? { cancelledAt } : {}) },
      }),
      prisma.booking.updateMany({
        where: { groupId: id },
        data: { status, ...(paidAt ? { paidAt } : {}), ...(cancelledAt ? { cancelledAt } : {}) },
      }),
    ]);
    await recordAudit({
      actor: actorFromSession(session),
      action: "UPDATE",
      entity: "BOOKING_GROUP",
      entityId: id,
      summary: `Изменил статус заказа ${group?.publicCode ?? id}: ${
        group?.status ?? "?"
      } → ${status}`,
      meta: { changed: { status: { from: group?.status ?? null, to: status } } },
      ip: getClientIp(req.headers),
    });
    return ok({ id, status });
  } catch (e) {
    return handleError(e, { req, action: "Изменение статуса заказа" });
  }
}

// Полное удаление группового заказа со всеми бронями (Booking.groupId — Restrict,
// поэтому сначала удаляем брони, затем группу; платёж снимется каскадом).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const group = await prisma.bookingGroup.findUnique({
      where: { id },
      select: { publicCode: true },
    });
    await prisma.$transaction([
      prisma.booking.deleteMany({ where: { groupId: id } }),
      prisma.bookingGroup.delete({ where: { id } }),
    ]);
    await recordAudit({
      actor: actorFromSession(session),
      action: "DELETE",
      entity: "BOOKING_GROUP",
      entityId: id,
      summary: `Удалил заказ ${group?.publicCode ?? id} со всеми бронями`,
      ip: getClientIp(req.headers),
    });
    return ok({ id });
  } catch (e) {
    return handleError(e, { req, action: "Удаление заказа" });
  }
}
