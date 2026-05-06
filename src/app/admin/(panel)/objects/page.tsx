import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ObjectsCreateForm } from "@/components/admin/ObjectsCreateForm";

export const dynamic = "force-dynamic";

export default async function ObjectsPage() {
  const [objects, types] = await Promise.all([
    prisma.bookingObject.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        objectType: { include: { category: true } },
        _count: { select: { bookings: true, media: true } },
      },
    }),
    prisma.objectType.findMany({ orderBy: { name: "asc" }, include: { category: true } }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Объекты</h1>
      <p className="text-sm text-muted-foreground">
        Создайте конкретный объект и заполните карточку, добавив медиа.
      </p>
      <ObjectsCreateForm
        types={types.map((t) => ({
          id: t.id,
          name: t.name,
          categoryName: t.category.name,
        }))}
      />
      <div className="grid gap-3">
        {objects.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{o.name}</span>
                  <Badge variant="secondary">{o.objectType.category.name}</Badge>
                  <Badge variant="outline">{o.objectType.name}</Badge>
                  <StatusPill status={o.status} />
                  <span className="text-xs text-muted-foreground">/{o.slug}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Броней: {o._count.bookings} · Медиа: {o._count.media} · Порядок: {o.sortOrder}
                </div>
              </div>
              <Link
                href={`/admin/objects/${o.id}`}
                className="px-3 py-2 rounded-md border text-sm hover:bg-slate-50"
              >
                Открыть
              </Link>
            </CardContent>
          </Card>
        ))}
        {objects.length === 0 && (
          <p className="text-sm text-muted-foreground">Объектов пока нет</p>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "ACTIVE") return <Badge variant="success">активен</Badge>;
  if (status === "HIDDEN") return <Badge variant="outline">скрыт</Badge>;
  return <Badge variant="warning">обслуживание</Badge>;
}
