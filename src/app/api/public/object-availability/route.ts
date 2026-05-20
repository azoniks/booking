import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api-utils";

const querySchema = z.object({
  objectId: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const { objectId, from, to } = querySchema.parse(
      Object.fromEntries(url.searchParams),
    );
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const obj = await prisma.bookingObject.findUnique({
      where: { id: objectId },
      include: {
        objectType: {
          include: {
            category: true,
            slots: { orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }] },
          },
        },
      },
    });
    if (!obj || obj.status !== "ACTIVE") return fail("Объект недоступен", 404);

    const t = obj.objectType;
    const cleaningMs = t.cleaningMinutes * 60_000;

    // Эффективные параметры предоплаты для фронта. FIXED — отдаём сумму;
    // фронт сам кламует её по итоговой стоимости. PERCENT — override типа >
    // глобальный из Settings > 100%.
    let paymentPercent = 100;
    let paymentAmount: number | null = null;
    const paymentType: "PERCENT" | "FIXED" =
      t.paymentType === "FIXED" && t.paymentAmount ? "FIXED" : "PERCENT";
    if (paymentType === "FIXED") {
      paymentAmount = Number(t.paymentAmount);
    } else if (t.paymentPercent && t.paymentPercent > 0) {
      paymentPercent = Math.min(100, Math.max(1, t.paymentPercent));
    } else {
      const s = await prisma.settings.findUnique({ where: { key: "paymentPercent" } });
      const v = s?.value !== undefined && s?.value !== null ? Number(s.value) : NaN;
      if (Number.isFinite(v) && v > 0) {
        paymentPercent = Math.min(100, Math.max(1, Math.round(v)));
      }
    }

    // Все брони чьё blockedUntil попадает в окно (или которые перекрывают окно)
    const bookings = await prisma.booking.findMany({
      where: {
        objectId,
        status: { in: ["PENDING", "PAID"] },
        // окно пересечения: bookingStart < windowEnd && bookingBlockedUntil > windowStart
        startAt: { lt: toDate },
        blockedUntil: { gt: fromDate },
      },
      select: {
        id: true,
        startAt: true,
        endAt: true,
        blockedUntil: true,
        sectionsBooked: true,
      },
    });

    const blocks = await prisma.objectBlock.findMany({
      where: {
        objectId,
        startAt: { lt: toDate },
        endAt: { gt: fromDate },
      },
      select: { id: true, startAt: true, endAt: true },
    });

    // Секционные типы: считаем занятость по дням внутри окна.
    // На каждый день суммируем sectionsBooked броней, которые перекрывают этот день
    // (по МСК-границам). Бронь с sectionsBooked === null трактуется как «вся площадка».
    const sectionsConfig =
      t.sectionsTotal && t.sectionCapacity
        ? {
            total: t.sectionsTotal,
            capacity: t.sectionCapacity,
            max: t.sectionsBookingMax ?? t.sectionsTotal,
            fullVenuePrice: t.fullVenuePrice ? Number(t.fullVenuePrice) : null,
          }
        : null;

    const daysOccupancy: { date: string; sectionsUsed: number; hasFullVenue: boolean }[] = [];
    if (sectionsConfig) {
      const TZ_OFFSET_MIN = 180; // Europe/Moscow
      const fromDayMs =
        Math.floor((fromDate.getTime() + TZ_OFFSET_MIN * 60_000) / 86_400_000) * 86_400_000;
      const toDayMs =
        Math.floor((toDate.getTime() + TZ_OFFSET_MIN * 60_000) / 86_400_000) * 86_400_000;
      for (let dayMs = fromDayMs; dayMs <= toDayMs; dayMs += 86_400_000) {
        // dayMs — МСК-полночь дня (в UTC-миллисекундах относительно МСК-grid)
        const dayStart = dayMs - TZ_OFFSET_MIN * 60_000;
        const dayEnd = dayStart + 86_400_000;
        let used = 0;
        let hasFull = false;
        for (const b of bookings) {
          const bs = b.startAt.getTime();
          const be = b.endAt.getTime() + cleaningMs;
          if (bs < dayEnd && be > dayStart) {
            const sec = b.sectionsBooked ?? sectionsConfig.total;
            used += sec;
            if (sec >= sectionsConfig.total) hasFull = true;
          }
        }
        const d = new Date(dayMs);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, "0");
        const day = String(d.getUTCDate()).padStart(2, "0");
        daysOccupancy.push({
          date: `${y}-${m}-${day}`,
          sectionsUsed: used,
          hasFullVenue: hasFull,
        });
      }
    }

    return ok({
      objectId,
      bookingMode: t.category.bookingMode,
      cleaningMinutes: t.cleaningMinutes,
      checkInTime: t.checkInTime,
      checkOutTime: t.checkOutTime,
      hourlyStepMinutes: t.hourlyStepMinutes,
      workingHoursStart: t.workingHoursStart,
      workingHoursEnd: t.workingHoursEnd,
      minBookingHours: t.minBookingHours,
      maxBookingHours: t.maxBookingHours,
      baseCapacity: t.baseCapacity,
      maxCapacity: t.maxCapacity,
      basePrice: Number(t.basePrice),
      extraGuestPrice: Number(t.extraGuestPrice),
      paymentPercent,
      paymentType,
      paymentAmount,
      sections: sectionsConfig,
      daysOccupancy: sectionsConfig ? daysOccupancy : [],
      slots: t.slots.map((s) => ({
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        priceOverride: s.priceOverride ? Number(s.priceOverride) : null,
        sortOrder: s.sortOrder,
      })),
      // bookings вместе с буфером уборки → это интервал недоступности для НОВОЙ брони
      busy: [
        ...bookings.map((b) => ({
          kind: "booking" as const,
          startAt: b.startAt.toISOString(),
          endAt: new Date(b.endAt.getTime() + cleaningMs).toISOString(),
        })),
        ...blocks.map((b) => ({
          kind: "block" as const,
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
        })),
      ],
    });
  } catch (e) {
    return handleError(e);
  }
}
