import type { Prisma } from "@prisma/client";

// Единый набор фильтров для списка броней и массового удаления — чтобы то,
// что показано на странице, и то, что удаляет «удалить по фильтру», совпадало.
export type BookingsFilterParams = {
  status?: string; // BookingStatus
  q?: string; // поиск: объект / гость / телефон / код брони
  type?: string; // ObjectType.id
  obj?: string; // BookingObject.id
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  dateField?: string; // "start" (по умолчанию) | "created"
};

// По какому полю брони применять период.
function rangeField(dateField?: string): "createdAt" | "startAt" {
  return dateField === "created" ? "createdAt" : "startAt";
}

/**
 * Строит Prisma-условие выборки броней по набору фильтров. Используется
 * и страницей списка, и DELETE-эндпоинтом массового удаления.
 */
export function buildBookingsWhere(
  p: BookingsFilterParams,
): Prisma.BookingWhereInput {
  const where: Prisma.BookingWhereInput = {};

  if (p.status) {
    where.status = p.status as Prisma.EnumBookingStatusFilter["equals"];
  }
  if (p.obj) where.objectId = p.obj;
  if (p.type) where.object = { objectTypeId: p.type };

  const q = p.q?.trim();
  if (q) {
    where.OR = [
      { object: { name: { contains: q, mode: "insensitive" } } },
      { guestName: { contains: q, mode: "insensitive" } },
      { guestPhone: { contains: q } },
      { publicCode: { contains: q, mode: "insensitive" } },
    ];
  }

  if (p.from || p.to) {
    const range: Prisma.DateTimeFilter = {};
    if (p.from) range.gte = new Date(p.from + "T00:00:00Z");
    if (p.to) range.lte = new Date(p.to + "T23:59:59Z");
    where[rangeField(p.dateField)] = range;
  }

  return where;
}

/** Число активных фильтров — для бейджа на кнопке «Фильтры» (моб.). */
export function countActiveBookingFilters(p: BookingsFilterParams): number {
  let n = 0;
  if (p.status) n++;
  if (p.q?.trim()) n++;
  if (p.type) n++;
  if (p.obj) n++;
  if (p.from || p.to) n++;
  return n;
}
