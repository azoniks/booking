import { prisma } from "./db";
import type { Prisma } from "@prisma/client";

export interface Interval {
  startAt: Date;
  endAt: Date;
}

/**
 * Два интервала пересекаются по «полузакрытой» логике [start, end):
 * касание границ (a.endAt === b.startAt) пересечением НЕ считается.
 */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

/**
 * Проверка свободен ли объект в [reqStart, reqEnd) с учётом
 * времени уборки cleaningMinutes (прибавляется к концу проверяемого слота).
 *
 * Возвращает массив пересекающихся броней/блокировок (пусто если свободен).
 */
export async function findConflicts(
  client: Prisma.TransactionClient | typeof prisma,
  args: {
    objectId: string;
    startAt: Date;
    endAt: Date;
    cleaningMinutes: number;
    excludeBookingId?: string;
  },
): Promise<{
  bookings: { id: string; startAt: Date; blockedUntil: Date; sectionsBooked: number | null }[];
  blocks: { id: string; startAt: Date; endAt: Date }[];
}> {
  const blockedUntil = new Date(args.endAt.getTime() + args.cleaningMinutes * 60_000);

  const bookings = await client.booking.findMany({
    where: {
      objectId: args.objectId,
      status: { in: ["PENDING", "PREPAID", "PAID"] },
      ...(args.excludeBookingId ? { NOT: { id: args.excludeBookingId } } : {}),
      // конфликт: a.start < b.end && b.start < a.end
      startAt: { lt: blockedUntil },
      blockedUntil: { gt: args.startAt },
    },
    select: { id: true, startAt: true, blockedUntil: true, sectionsBooked: true },
  });

  const blocks = await client.objectBlock.findMany({
    where: {
      objectId: args.objectId,
      startAt: { lt: blockedUntil },
      endAt: { gt: args.startAt },
    },
    select: { id: true, startAt: true, endAt: true },
  });

  return { bookings, blocks };
}

export async function isAvailable(
  client: Prisma.TransactionClient | typeof prisma,
  args: {
    objectId: string;
    startAt: Date;
    endAt: Date;
    cleaningMinutes: number;
    excludeBookingId?: string;
  },
): Promise<boolean> {
  const c = await findConflicts(client, args);
  return c.bookings.length === 0 && c.blocks.length === 0;
}
