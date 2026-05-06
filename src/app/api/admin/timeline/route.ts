import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const url = new URL(req.url);
    const { from, to } = querySchema.parse(Object.fromEntries(url.searchParams));
    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    // Только видимые/активные категории и активные объекты — для шахматки
    // показываем все объекты (включая HIDDEN/MAINTENANCE) — админу полезно видеть всё.
    const types = await prisma.objectType.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      include: {
        category: true,
        objects: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true, slug: true, status: true },
        },
      },
    });

    const objectIds = types.flatMap((t) => t.objects.map((o) => o.id));

    const [bookings, blocks] = await Promise.all([
      prisma.booking.findMany({
        where: {
          objectId: { in: objectIds },
          status: { in: ["PENDING", "PAID"] },
          startAt: { lt: toDate },
          blockedUntil: { gt: fromDate },
        },
        select: {
          id: true,
          publicCode: true,
          objectId: true,
          startAt: true,
          endAt: true,
          blockedUntil: true,
          status: true,
          guestName: true,
          guestPhone: true,
          guestsCount: true,
          totalPrice: true,
        },
        orderBy: { startAt: "asc" },
      }),
      prisma.objectBlock.findMany({
        where: {
          objectId: { in: objectIds },
          startAt: { lt: toDate },
          endAt: { gt: fromDate },
        },
        select: {
          id: true,
          objectId: true,
          startAt: true,
          endAt: true,
          reason: true,
        },
      }),
    ]);

    return ok({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      types: types
        .filter((t) => t.objects.length > 0)
        .map((t) => ({
          id: t.id,
          name: t.name,
          categoryName: t.category.name,
          bookingMode: t.category.bookingMode,
          cleaningMinutes: t.cleaningMinutes,
          objects: t.objects.map((o) => ({
            id: o.id,
            name: o.name,
            slug: o.slug,
            status: o.status,
          })),
        })),
      bookings: bookings.map((b) => ({
        ...b,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        blockedUntil: b.blockedUntil.toISOString(),
        totalPrice: b.totalPrice.toString(),
      })),
      blocks: blocks.map((b) => ({
        ...b,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
