import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, requireAdmin, unauth } from "@/lib/api-utils";
import { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const objectId = url.searchParams.get("objectId");
  const from = url.searchParams.get("from"); // YYYY-MM-DD
  const to = url.searchParams.get("to");

  const where: Prisma.BookingWhereInput = {};
  if (status) where.status = status as Prisma.EnumBookingStatusFilter["equals"];
  if (objectId) where.objectId = objectId;
  if (from) where.startAt = { ...(where.startAt as object), gte: new Date(from + "T00:00:00Z") };
  if (to) where.startAt = { ...(where.startAt as object), lte: new Date(to + "T23:59:59Z") };

  const items = await prisma.booking.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      object: { include: { objectType: { include: { category: true } } } },
      payment: true,
    },
  });
  return ok(items);
}
