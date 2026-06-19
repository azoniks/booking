import { prisma } from "@/lib/db";
import { CategoriesManager } from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const items = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { objectTypes: true } } },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold px-4 md:px-6">Категории</h1>
      <p className="text-sm text-muted-foreground px-4 md:px-6">
        Категории — это вкладки на главной. Порядок задаёт сортировку вкладок.
      </p>
      <CategoriesManager
        initial={items.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          sortOrder: c.sortOrder,
          isVisible: c.isVisible,
          bookingMode: c.bookingMode,
          typesCount: c._count.objectTypes,
        }))}
      />
    </div>
  );
}
