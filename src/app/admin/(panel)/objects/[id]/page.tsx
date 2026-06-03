import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ObjectEditor } from "@/components/admin/ObjectEditor";

export const dynamic = "force-dynamic";

export default async function ObjectEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [obj, types, candidates] = await Promise.all([
    prisma.bookingObject.findUnique({
      where: { id },
      include: {
        objectType: { include: { category: true } },
        media: { orderBy: { sortOrder: "asc" } },
        addons: { select: { id: true } },
      },
    }),
    prisma.objectType.findMany({ orderBy: { name: "asc" }, include: { category: true } }),
    // Кандидаты в аддоны — все прочие объекты (с категорией для подписи).
    prisma.bookingObject.findMany({
      orderBy: [{ name: "asc" }],
      include: { objectType: { include: { category: true } } },
    }),
  ]);
  if (!obj) notFound();

  return (
    <ObjectEditor
      obj={{
        id: obj.id,
        name: obj.name,
        slug: obj.slug,
        description: obj.description,
        status: obj.status,
        isAddon: obj.isAddon,
        sortOrder: obj.sortOrder,
        objectTypeId: obj.objectTypeId,
        categoryName: obj.objectType.category.name,
        typeName: obj.objectType.name,
        addonIds: obj.addons.map((a) => a.id),
        media: obj.media.map((m) => ({
          id: m.id,
          type: m.type,
          url: m.url,
          isMain: m.isMain,
          sortOrder: m.sortOrder,
        })),
      }}
      types={types.map((t) => ({ id: t.id, name: t.name, categoryName: t.category.name }))}
      addonCandidates={candidates
        .filter((c) => c.id !== obj.id)
        .map((c) => ({
          id: c.id,
          name: c.name,
          categoryName: c.objectType.category.name,
        }))}
    />
  );
}
