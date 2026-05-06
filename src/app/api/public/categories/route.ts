import { prisma } from "@/lib/db";
import { ok } from "@/lib/api-utils";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { isVisible: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      objectTypes: {
        include: {
          objects: {
            where: { status: "ACTIVE" },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            include: {
              media: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
            },
          },
        },
      },
    },
  });
  return ok(categories);
}
