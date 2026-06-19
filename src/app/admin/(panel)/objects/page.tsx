import { prisma } from "@/lib/db";
import { ObjectsList } from "@/components/admin/ObjectsList";

export const dynamic = "force-dynamic";

export default async function ObjectsPage() {
  const [objects, types, categories] = await Promise.all([
    prisma.bookingObject.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        objectType: { include: { category: true } },
        _count: { select: { bookings: true, media: true } },
      },
    }),
    prisma.objectType.findMany({ orderBy: { name: "asc" }, include: { category: true } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold px-4 md:px-6">Объекты</h1>
      <p className="text-sm text-muted-foreground px-4 md:px-6">
        Создайте конкретный объект и заполните карточку, добавив медиа.
      </p>
      <ObjectsList
        objects={objects.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          status: o.status,
          sortOrder: o.sortOrder,
          categoryId: o.objectType.categoryId,
          categoryName: o.objectType.category.name,
          typeName: o.objectType.name,
          bookingsCount: o._count.bookings,
          mediaCount: o._count.media,
        }))}
        types={types.map((t) => ({
          id: t.id,
          name: t.name,
          categoryId: t.categoryId,
          categoryName: t.category.name,
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
