import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";

const patchSchema = z.object({
  status: z.enum(["PENDING", "PREPAID", "PAID", "CANCELLED"]),
});

// Смена статуса оплаты заказа: меняет статус группы и всех её броней атомарно.
// paidAt выставляется только при полной оплате (PAID).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const { status } = patchSchema.parse(await req.json());
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
    return ok({ id, status });
  } catch (e) {
    return handleError(e);
  }
}

// Полное удаление группового заказа со всеми бронями (Booking.groupId — Restrict,
// поэтому сначала удаляем брони, затем группу; платёж снимется каскадом).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    await prisma.$transaction([
      prisma.booking.deleteMany({ where: { groupId: id } }),
      prisma.bookingGroup.delete({ where: { id } }),
    ]);
    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}
