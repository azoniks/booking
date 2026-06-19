import { prisma } from "@/lib/db";
import { BookingsTimeline } from "@/components/admin/BookingsTimeline";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Объекты для форм создания брони прямо с дашборда (как в bookings/page.tsx и
  // new-group/page.tsx). Берём ВСЕ активные, включая аддоны — групповой форме они
  // нужны; одиночная форма ниже отфильтрует isAddon.
  const objects = await prisma.bookingObject.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ name: "asc" }],
    include: {
      objectType: {
        include: {
          category: true,
          slots: { orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }] },
        },
      },
      addons: { where: { status: "ACTIVE" }, select: { id: true, name: true } },
    },
  });

  // Одиночная форма (AdminBookingCreateForm.FormObject) — без аддонов как основных.
  const singleFormObjects = objects
    .filter((o) => !o.isAddon)
    .map((o) => ({
      id: o.id,
      name: o.name,
      categoryName: o.objectType.category.name,
      typeName: o.objectType.name,
      bookingMode: o.objectType.category.bookingMode,
      checkInTime: o.objectType.checkInTime,
      checkOutTime: o.objectType.checkOutTime,
      baseCapacity: o.objectType.baseCapacity,
      maxCapacity: o.objectType.maxCapacity,
      basePrice: Number(o.objectType.basePrice),
      slots: o.objectType.slots.map((s) => ({
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        endDayOffset: s.endDayOffset,
      })),
      addons: o.addons.map((a) => ({ id: a.id, name: a.name })),
    }));

  // Групповая форма (AdminGroupCreateForm.ObjOption) — включает аддоны.
  const groupFormObjects = objects.map((o) => ({
    id: o.id,
    name: o.name,
    categoryName: o.objectType.category.name,
    typeName: o.objectType.name,
    baseCapacity: o.objectType.baseCapacity,
    basePrice: Number(o.objectType.basePrice),
    isAddon: o.isAddon,
    addons: o.addons.map((a) => ({ id: a.id, name: a.name })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold px-4 md:px-6">Дашборд</h1>

      <BookingsTimeline
        singleFormObjects={singleFormObjects}
        groupFormObjects={groupFormObjects}
      />
    </div>
  );
}
