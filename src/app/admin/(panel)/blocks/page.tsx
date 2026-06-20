import { prisma } from "@/lib/db";
import { BlocksManager } from "@/components/admin/BlocksManager";

export const dynamic = "force-dynamic";

export default async function BlocksPage() {
  const [blocks, objects] = await Promise.all([
    prisma.objectBlock.findMany({
      orderBy: { startAt: "asc" },
      include: { object: true },
    }),
    prisma.bookingObject.findMany({
      orderBy: { name: "asc" },
      include: { objectType: { include: { category: true } } },
    }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Блокировки</h1>
      <p className="text-sm text-muted-foreground">
        Ручная блокировка времени объекта (ремонт, личное использование).
      </p>
      <BlocksManager
        initial={blocks.map((b) => ({
          id: b.id,
          objectId: b.objectId,
          objectName: b.object.name,
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
          reason: b.reason,
        }))}
        objects={objects.map((o) => ({
          id: o.id,
          name: o.name,
          categoryName: o.objectType.category.name,
        }))}
      />
    </div>
  );
}
