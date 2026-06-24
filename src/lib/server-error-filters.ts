import type { Prisma, ErrorSource } from "@prisma/client";

export const SOURCE_LABELS: Record<ErrorSource, string> = {
  API: "API",
  RENDER: "Рендер",
  SCHEDULER: "Планировщик",
  OTHER: "Прочее",
};

export const SOURCE_VALUES = Object.keys(SOURCE_LABELS) as ErrorSource[];

export type ServerErrorFilterParams = {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  source?: string; // ErrorSource
  q?: string; // поиск по message/path
  unresolved?: string; // "1" → только неразобранные
};

export function buildServerErrorWhere(
  p: ServerErrorFilterParams,
): Prisma.ServerErrorLogWhereInput {
  const where: Prisma.ServerErrorLogWhereInput = {};

  if (p.source && (SOURCE_VALUES as string[]).includes(p.source)) {
    where.source = p.source as ErrorSource;
  }
  if (p.unresolved === "1") where.resolvedAt = null;

  const q = p.q?.trim();
  if (q) {
    where.OR = [
      { message: { contains: q, mode: "insensitive" } },
      { path: { contains: q, mode: "insensitive" } },
    ];
  }

  if (p.from || p.to) {
    const range: Prisma.DateTimeFilter = {};
    if (p.from) range.gte = new Date(p.from + "T00:00:00Z");
    if (p.to) range.lte = new Date(p.to + "T23:59:59Z");
    where.createdAt = range;
  }

  return where;
}

export function countActiveServerErrorFilters(p: ServerErrorFilterParams): number {
  let n = 0;
  if (p.source) n++;
  if (p.q?.trim()) n++;
  if (p.unresolved === "1") n++;
  if (p.from || p.to) n++;
  return n;
}
