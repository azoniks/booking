import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { sendStatusChangeNotifications } from "@/lib/notifications/email";
import { rescheduleBooking } from "@/lib/booking-service";
import { bookingRescheduleSchema } from "@/lib/validators";
import { recordAudit, actorFromSession, changedFields } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["PENDING", "PREPAID", "PAID", "CANCELLED", "COMPLETED", "NO_SHOW"]).optional(),
  cancelReason: z.string().max(500).optional(),
  guestName: z.string().min(2).max(100).optional(),
  guestEmail: z.string().email().or(z.literal("")).optional(),
  guestPhone: z.string().min(1).max(30).optional(),
  guestComment: z.string().max(1000).optional().nullable(),
  guestsCount: z.coerce.number().int().min(1).max(50).optional(),
  // Перенос брони: если передан — пересчитываем даты/цену (см. rescheduleBooking).
  schedule: bookingRescheduleSchema.optional(),
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const { id } = await params;
    const existing = await prisma.booking.findUnique({
      where: { id },
      select: { publicCode: true, guestName: true },
    });
    await prisma.booking.delete({ where: { id } });
    await recordAudit({
      actor: actorFromSession(session),
      action: "DELETE",
      entity: "BOOKING",
      entityId: id,
      summary: `Удалил бронь ${existing?.publicCode ?? id}${
        existing?.guestName ? ` (${existing.guestName})` : ""
      }`,
      ip: getClientIp(req.headers),
    });
    return ok({ id });
  } catch (e) {
    return handleError(e, { req, action: "Удаление брони" });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return unauth();
  const attempt: { req: NextRequest; action: string; context?: unknown } = {
    req,
    action: "Изменение брони",
  };
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    attempt.context = {
      bookingId: id,
      fields: Object.keys(body),
      newStatus: body.status,
      rescheduled: !!body.schedule,
    };
    const before = await prisma.booking.findUnique({
      where: { id },
      select: {
        publicCode: true,
        status: true,
        guestName: true,
        guestEmail: true,
        guestPhone: true,
        guestsCount: true,
      },
    });

    // Перенос дат/времени (с пересчётом цены и проверкой пересечений) — отдельно,
    // транзакцией внутри сервиса. guestsCount при переносе берётся из schedule.
    if (body.schedule) {
      await rescheduleBooking(id, body.schedule);
    }

    const data: Record<string, unknown> = { ...body };
    delete data.schedule;
    // guestsCount уже применён переносом — не дублируем.
    if (body.schedule) delete data.guestsCount;
    if (typeof body.guestName === "string") data.guestName = body.guestName.trim();
    if (typeof body.guestEmail === "string") data.guestEmail = body.guestEmail.trim().toLowerCase();
    if (typeof body.guestPhone === "string") data.guestPhone = body.guestPhone.trim();
    if (body.guestComment !== undefined) {
      const c = (body.guestComment ?? "").trim();
      data.guestComment = c || null;
    }
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
    const diff = before
      ? changedFields(before, updated, [
          "status",
          "guestName",
          "guestEmail",
          "guestPhone",
          "guestsCount",
        ])
      : {};
    await recordAudit({
      actor: actorFromSession(session),
      action: "UPDATE",
      entity: "BOOKING",
      entityId: id,
      summary: `Изменил бронь ${before?.publicCode ?? id}${
        body.schedule ? " (перенос)" : ""
      }`,
      meta: { changed: diff, rescheduled: !!body.schedule },
      ip: getClientIp(req.headers),
    });
    return ok(updated);
  } catch (e) {
    return handleError(e, attempt);
  }
}
