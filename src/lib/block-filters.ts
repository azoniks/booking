import type { Prisma } from "@prisma/client";

// Единый набор фильтров для списка блокировок и массового удаления — чтобы то,
// что показано на странице, и то, что удаляет «удалить по фильтру», совпадало.
// Категории и типы сужают выбор объектов (каскад); объекты — множественный
// выбор. В URL множественные значения хранятся как CSV: obj=id1,id2.
export type BlocksFilterParams = {
  q?: string; // поиск: объект / причина
  cats?: string[]; // Category.id[]
  types?: string[]; // ObjectType.id[]
  objs?: string[]; // BookingObject.id[]
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  dateField?: string; // "start" (дата блокировки, по умолчанию) | "created"
};

// По какому полю блокировки применять период.
function rangeField(dateField?: string): "createdAt" | "startAt" {
  return dateField === "created" ? "createdAt" : "startAt";
}

// Парсит фильтры из произвольного источника параметров (searchParams страницы
// или URLSearchParams роута). CSV-параметры cat/type/obj разбираются в массивы.
export function parseBlocksFilters(
  get: (key: string) => string | null | undefined,
): BlocksFilterParams {
  const csv = (v: string | null | undefined) => {
    const arr = (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    return arr.length ? arr : undefined;
  };
  return {
    q: get("q") || undefined,
    cats: csv(get("cat")),
    types: csv(get("type")),
    objs: csv(get("obj")),
    from: get("from") || undefined,
    to: get("to") || undefined,
    dateField: get("dateField") || undefined,
  };
}

/**
 * Строит Prisma-условие выборки блокировок по набору фильтров. Используется
 * и страницей списка, и DELETE-эндпоинтом массового удаления.
 */
export function buildBlocksWhere(
  p: BlocksFilterParams,
): Prisma.ObjectBlockWhereInput {
  const where: Prisma.ObjectBlockWhereInput = {};

  if (p.objs?.length) where.objectId = { in: p.objs };

  // Категории и типы — через связь object.objectType.
  const typeWhere: Prisma.ObjectTypeWhereInput = {};
  if (p.cats?.length) typeWhere.categoryId = { in: p.cats };
  if (p.types?.length) typeWhere.id = { in: p.types };
  if (Object.keys(typeWhere).length > 0) {
    where.object = { objectType: typeWhere };
  }

  const q = p.q?.trim();
  if (q) {
    where.OR = [
      { object: { name: { contains: q, mode: "insensitive" } } },
      { reason: { contains: q, mode: "insensitive" } },
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
export function countActiveBlockFilters(p: BlocksFilterParams): number {
  let n = 0;
  if (p.q?.trim()) n++;
  if (p.cats?.length) n++;
  if (p.types?.length) n++;
  if (p.objs?.length) n++;
  if (p.from || p.to) n++;
  return n;
}
