import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError } from "@/lib/api-utils";
import { availabilityQuerySchema } from "@/lib/validators";
import { isAvailable } from "@/lib/availability";
import { localDateTimeToUtc } from "@/lib/time";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const params = availabilityQuerySchema.parse(Object.fromEntries(url.searchParams));
    const obj = await prisma.bookingObject.findUnique({
      where: { id: params.objectId },
      include: { objectType: { include: { category: true } } },
    });
    if (!obj || obj.status !== "ACTIVE") return fail("Объект недоступен", 404);

    let startAt: Date, endAt: Date;
    if (obj.objectType.category.bookingMode === "DAILY") {
      if (!params.checkInDate || !params.checkOutDate)
        return fail("checkInDate и checkOutDate обязательны", 400);
      if (!obj.objectType.checkInTime || !obj.objectType.checkOutTime)
        return fail("Тип объекта не настроен", 400);
      startAt = localDateTimeToUtc(params.checkInDate, obj.objectType.checkInTime);
      endAt = localDateTimeToUtc(params.checkOutDate, obj.objectType.checkOutTime);
    } else {
      if (!params.startAt || !params.endAt) return fail("startAt и endAt обязательны", 400);
      startAt = new Date(params.startAt);
      endAt = new Date(params.endAt);
    }

    if (endAt <= startAt) return fail("Конец должен быть после начала", 400);

    const available = await isAvailable(prisma, {
      objectId: obj.id,
      startAt,
      endAt,
      cleaningMinutes: obj.objectType.cleaningMinutes,
    });
    return ok({ available });
  } catch (e) {
    return handleError(e);
  }
}
