import { prisma } from "@/lib/db";
import { CategoryTabs } from "@/components/client/CategoryTabs";
import { SiteHeader } from "@/components/client/SiteHeader";
import { slotDurationHours } from "@/lib/slots";

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
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          include: {
            media: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
            slots: { select: { id: true, priceOverride: true, startTime: true, endTime: true, endDayOffset: true } },
            objects: {
              // Берём все активные объекты (включая аддоны), чтобы ниже отличить
              // вид объекта без объектов («скоро») от вида, у которого все
              // объекты — аддоны (напр. «Трейлер») и который надо скрыть целиком.
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />

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
              objectTypes: c.objectTypes
                // Аддоны (трейлеры) бронируются только из карточки родителя.
                // Скрываем вид объекта, у которого ВСЕ активные объекты — аддоны:
                // как самостоятельный вид он не существует. Виды вообще без
                // объектов («скоро») оставляем — это отдельный кейс витрины.
                .filter((t) => {
                  const visible = t.objects.filter((o) => !o.isAddon);
                  return visible.length > 0 || t.objects.length === 0;
                })
                .map((t) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                checkInTime: t.checkInTime,
                checkOutTime: t.checkOutTime,
                hourlyStepMinutes: t.hourlyStepMinutes,
                workingHoursStart: t.workingHoursStart,
                workingHoursEnd: t.workingHoursEnd,
                workingHoursText: t.workingHoursText,
                minBookingHours: t.minBookingHours,
                maxBookingHours: t.maxBookingHours,
                cleaningMinutes: t.cleaningMinutes,
                baseCapacity: t.baseCapacity,
                maxCapacity: t.maxCapacity,
                basePrice: t.basePrice.toString(),
                extraGuestPrice: t.extraGuestPrice.toString(),
                hasSlots: t.slots.length > 0,
                slotMinPrice: (() => {
                  if (t.slots.length === 0) return null;
                  const base = Number(t.basePrice);
                  const prices = t.slots.map((s) => {
                    if (s.priceOverride !== null && s.priceOverride !== undefined) {
                      return Number(s.priceOverride);
                    }
                    return Math.ceil(slotDurationHours(s)) * base;
                  });
                  return Math.min(...prices);
                })(),
                sections:
                  t.sectionsTotal && t.sectionCapacity
                    ? {
                        total: t.sectionsTotal,
                        capacity: t.sectionCapacity,
                        max: t.sectionsBookingMax ?? t.sectionsTotal,
                        fullVenuePrice: t.fullVenuePrice
                          ? Number(t.fullVenuePrice)
                          : null,
                      }
                    : null,
                objects: t.objects
                  .filter((o) => !o.isAddon)
                  .map((o) => {
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
          <div>© {new Date().getFullYear()} {siteName}</div>
        </div>
      </footer>
    </div>
  );
}
