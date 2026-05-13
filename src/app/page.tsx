import { prisma } from "@/lib/db";
import { CategoryTabs } from "@/components/client/CategoryTabs";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat: initialCatSlug } = await searchParams;
  const [categories, settings] = await Promise.all([
    prisma.category.findMany({
      where: { isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        objectTypes: {
          include: {
            media: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
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
    }),
    prisma.settings.findMany(),
  ]);

  const settingsMap = new Map<string, unknown>(settings.map((s) => [s.key, s.value]));
  const siteName = String(settingsMap.get("siteName") || "Бронирование");
  const siteContact = String(settingsMap.get("siteContact") || "");

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between gap-4">
          <h1 className="text-xl md:text-2xl font-bold">{siteName}</h1>
          {siteContact && (
            <a href={`tel:${siteContact}`} className="text-sm text-muted-foreground hover:text-foreground">
              {siteContact}
            </a>
          )}
        </div>
      </header>

      <main className="container py-6 flex-1">
        {categories.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            Пока нет категорий. Зайдите в админку и создайте.
          </div>
        ) : (
          <CategoryTabs
            initialSlug={initialCatSlug}
            categories={categories.map((c) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
              description: c.description,
              bookingMode: c.bookingMode,
              objectTypes: c.objectTypes.map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                checkInTime: t.checkInTime,
                checkOutTime: t.checkOutTime,
                hourlyStepMinutes: t.hourlyStepMinutes,
                workingHoursStart: t.workingHoursStart,
                workingHoursEnd: t.workingHoursEnd,
                minBookingHours: t.minBookingHours,
                maxBookingHours: t.maxBookingHours,
                cleaningMinutes: t.cleaningMinutes,
                baseCapacity: t.baseCapacity,
                maxCapacity: t.maxCapacity,
                basePrice: t.basePrice.toString(),
                extraGuestPrice: t.extraGuestPrice.toString(),
                objects: t.objects.map((o) => {
                  const ownMedia = o.media.map((m) => ({
                    id: m.id,
                    type: m.type,
                    url: m.url,
                    isMain: m.isMain,
                  }));
                  const typeFallback = t.media.map((m) => ({
                    id: m.id,
                    type: m.type,
                    url: m.url,
                    isMain: m.isMain,
                  }));
                  return {
                    id: o.id,
                    name: o.name,
                    slug: o.slug,
                    description: o.description,
                    media: ownMedia.length > 0 ? ownMedia : typeFallback,
                  };
                }),
              })),
            }))}
          />
        )}
      </main>

      <footer className="border-t py-6 bg-white">
        <div className="container text-center text-sm text-muted-foreground">
          {siteContact && <div>{siteContact}</div>}
          <div>© {new Date().getFullYear()} {siteName}</div>
        </div>
      </footer>
    </div>
  );
}
