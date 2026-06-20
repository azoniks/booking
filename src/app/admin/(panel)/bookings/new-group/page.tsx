import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminGroupCreateForm } from "@/components/admin/AdminGroupCreateForm";

export const dynamic = "force-dynamic";

export default async function NewGroupPage() {
  const objects = await prisma.bookingObject.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ name: "asc" }],
    include: {
      objectType: { include: { category: true } },
      addons: { where: { status: "ACTIVE" }, select: { id: true, name: true } },
    },
  });

  const formObjects = objects.map((o) => ({
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
    <div className="space-y-4 max-w-3xl">
      <Link href="/admin/bookings" className="text-sm text-muted-foreground hover:underline">
        ← Все брони
      </Link>
      <h1 className="text-2xl font-bold">Новый групповой заказ</h1>
      <p className="text-sm text-muted-foreground">
        Добавьте несколько объектов, задайте каждому даты/время и число гостей. Заказ
        создаётся как единая группа с одним платежом.
      </p>
      <AdminGroupCreateForm objects={formObjects} />
    </div>
  );
}
