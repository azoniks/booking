import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";

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
