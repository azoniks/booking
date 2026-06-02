import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { categoryUpdateSchema } from "@/lib/validators";
import { formatLocal, formatLocalTime } from "@/lib/time";

type BookingMode = "DAILY" | "HOURLY" | "FULL_DAY";

const MODE_LABEL: Record<BookingMode, string> = {
  DAILY: "Сутки",
  HOURLY: "Часы",
  FULL_DAY: "День",
};

type TypeTimes = {
  checkInTime: string | null;
  checkOutTime: string | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
};

// Соответствует ли время брони новому режиму категории.
// HOURLY допускает любой интервал; DAILY/FULL_DAY — только совпадение
// времени с настройками типа (заезд/выезд или рабочие часы).
function bookingConformsToMode(
  startAt: Date,
  endAt: Date,
  type: TypeTimes,
  mode: BookingMode,
): boolean {
  if (mode === "HOURLY") return true;
  const startHM = formatLocalTime(startAt);
  const endHM = formatLocalTime(endAt);
  if (mode === "DAILY") {
    if (!type.checkInTime || !type.checkOutTime) return false;
    return startHM === type.checkInTime && endHM === type.checkOutTime;
  }
  // FULL_DAY — один день целиком в рабочие часы
  if (!type.workingHoursStart || !type.workingHoursEnd) return false;
  const sameDay =
    formatLocal(startAt, "yyyy-MM-dd") === formatLocal(endAt, "yyyy-MM-dd");
  return (
    sameDay && startHM === type.workingHoursStart && endHM === type.workingHoursEnd
  );
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const raw = await req.json();
    // force=true приходит после подтверждения админом смены режима при
    // наличии активных броней с несоответствующим временем.
    const force = raw?.force === true;
    const body = categoryUpdateSchema.parse(raw);

    const current = await prisma.category.findUnique({ where: { id } });
    if (!current) return fail("Категория не найдена", 404);

    const newMode = body.bookingMode as BookingMode | undefined;
    const modeChanging = !!newMode && newMode !== current.bookingMode;

    if (modeChanging && !force) {
      const active = await prisma.booking.findMany({
        where: {
          object: { objectType: { categoryId: id } },
          status: { in: ["PENDING", "PAID"] },
          endAt: { gt: new Date() },
        },
        select: {
          startAt: true,
          endAt: true,
          object: {
            select: {
              objectType: {
                select: {
                  checkInTime: true,
                  checkOutTime: true,
                  workingHoursStart: true,
                  workingHoursEnd: true,
                },
              },
            },
          },
        },
      });

      const mismatched = active.filter(
        (b) => !bookingConformsToMode(b.startAt, b.endAt, b.object.objectType, newMode!),
      ).length;

      if (mismatched > 0) {
        return fail(
          `В категории есть активные брони, чьё время не соответствует режиму «${MODE_LABEL[newMode!]}»: ${mismatched} из ${active.length}. ` +
            `Они сохранятся со своим временем, новые брони будут оформляться по новому режиму.`,
          409,
          { needsConfirmation: true, mismatched, active: active.length },
        );
      }
    }

    const updated = await prisma.category.update({ where: { id }, data: body });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const types = await prisma.objectType.count({ where: { categoryId: id } });
    if (types > 0) return fail("Сначала удалите типы объектов в этой категории", 400);
    await prisma.category.delete({ where: { id } });
    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}
