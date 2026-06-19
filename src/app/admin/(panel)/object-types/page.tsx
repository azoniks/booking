import { prisma } from "@/lib/db";
import { ObjectTypesManager } from "@/components/admin/ObjectTypesManager";

export const dynamic = "force-dynamic";

export default async function ObjectTypesPage() {
  const [types, categories] = await Promise.all([
    prisma.objectType.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        category: true,
        _count: { select: { objects: true } },
        slots: { orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }] },
        media: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold px-4 md:px-6">Типы объектов</h1>
      <p className="text-sm text-muted-foreground px-4 md:px-6">
        Тип задаёт правила для группы объектов: время заезда/выезда (для номеров) или шаг и рабочие часы (для почасовых),
        вместимость, цены и время уборки.
      </p>
      <ObjectTypesManager
        initialTypes={types.map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
          categoryId: t.categoryId,
          categoryName: t.category.name,
          bookingMode: t.category.bookingMode,
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
          paymentType: t.paymentType,
          paymentPercent: t.paymentPercent,
          paymentAmount: t.paymentAmount ? t.paymentAmount.toString() : null,
          sortOrder: t.sortOrder,
          sectionsTotal: t.sectionsTotal,
          sectionCapacity: t.sectionCapacity,
          sectionsBookingMax: t.sectionsBookingMax,
          fullVenuePrice: t.fullVenuePrice ? t.fullVenuePrice.toString() : null,
          objectsCount: t._count.objects,
          slots: t.slots.map((s) => ({
            id: s.id,
            name: s.name,
            startTime: s.startTime,
            endTime: s.endTime,
            endDayOffset: s.endDayOffset,
            priceOverride: s.priceOverride ? s.priceOverride.toString() : null,
            sortOrder: s.sortOrder,
          })),
          media: t.media.map((m) => ({
            id: m.id,
            type: m.type,
            url: m.url,
            isMain: m.isMain,
            sortOrder: m.sortOrder,
          })),
        }))}
        categories={categories.map((c) => ({ id: c.id, name: c.name, bookingMode: c.bookingMode }))}
      />
    </div>
  );
}
