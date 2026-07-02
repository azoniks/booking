import Link from "next/link";
import { FilterX } from "lucide-react";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { formatLocal } from "@/lib/time";
import { BlockCreateForm } from "@/components/admin/BlockCreateForm";
import {
  BlockRowDelete,
  BlocksBulkDelete,
} from "@/components/admin/BlocksListRowActions";
import { CollapsibleFilters } from "@/components/admin/CollapsibleFilters";
import { BlocksFilters } from "@/components/admin/BlocksFilters";
import {
  buildBlocksWhere,
  countActiveBlockFilters,
  parseBlocksFilters,
} from "@/lib/block-filters";

export const dynamic = "force-dynamic";

export default async function BlocksPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    cat?: string;
    type?: string;
    obj?: string;
    from?: string;
    to?: string;
    dateField?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters = parseBlocksFilters((k) => (sp as Record<string, string | undefined>)[k]);
  // Сырые строки параметров — для «удалить по фильтру» (тот же формат URL).
  const rawFilters = {
    q: sp.q,
    cat: sp.cat,
    type: sp.type,
    obj: sp.obj,
    from: sp.from,
    to: sp.to,
    dateField: sp.dateField,
  };
  const where = buildBlocksWhere(filters);

  const [blocks, objects] = await Promise.all([
    prisma.objectBlock.findMany({
      where,
      orderBy: { startAt: "asc" },
      include: { object: { include: { objectType: { include: { category: true } } } } },
    }),
    prisma.bookingObject.findMany({
      orderBy: { name: "asc" },
      include: { objectType: { include: { category: true } } },
    }),
  ]);

  // Списки для селекторов фильтра выводим из объектов: категории/типы
  // дедуплицируем по id; объекты несут typeId и categoryId для каскада.
  const filterObjects = objects.map((o) => ({
    id: o.id,
    name: o.name,
    typeId: o.objectType.id,
    categoryId: o.objectType.category.id,
  }));
  const filterTypes = Array.from(
    new Map(
      objects.map((o) => [
        o.objectType.id,
        {
          id: o.objectType.id,
          name: o.objectType.name,
          categoryName: o.objectType.category.name,
          categoryId: o.objectType.category.id,
        },
      ]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "ru"));
  const filterCategories = Array.from(
    new Map(
      objects.map((o) => [o.objectType.category.id, {
        id: o.objectType.category.id,
        name: o.objectType.category.name,
      }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const formObjects = objects.map((o) => ({
    id: o.id,
    name: o.name,
    categoryName: o.objectType.category.name,
  }));

  const activeFilterCount = countActiveBlockFilters(filters);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Блокировки</h1>
          <p className="text-sm text-muted-foreground">
            {blocks.length === 0
              ? "Записей нет"
              : `Записей: ${blocks.length}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <Link
              href="/admin/blocks"
              className="inline-flex items-center gap-1.5 h-10 px-3 rounded-md border bg-background text-sm text-muted-foreground hover:bg-slate-50 whitespace-nowrap"
              title="Сбросить все фильтры"
            >
              <FilterX className="w-4 h-4" />
              <span className="hidden sm:inline">Сбросить фильтры</span>
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs">
                {activeFilterCount}
              </span>
            </Link>
          )}
          <BlocksBulkDelete filters={rawFilters} visibleCount={blocks.length} />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Ручная блокировка времени объекта (ремонт, личное использование).
      </p>

      <BlockCreateForm objects={formObjects} />

      <CollapsibleFilters activeCount={activeFilterCount}>
        <BlocksFilters
          categories={filterCategories}
          types={filterTypes}
          objects={filterObjects}
          current={filters}
        />
      </CollapsibleFilters>

      <div className="space-y-2">
        {blocks.map((b) => (
          <Card key={b.id}>
            <CardContent className="p-3 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium">{b.object.name}</div>
                <div className="text-sm text-muted-foreground">
                  {formatLocal(b.startAt)} — {formatLocal(b.endAt)}
                </div>
                {b.reason && <div className="text-sm">{b.reason}</div>}
              </div>
              <BlockRowDelete id={b.id} objectName={b.object.name} />
            </CardContent>
          </Card>
        ))}
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground">Блокировок нет</p>
        )}
      </div>
    </div>
  );
}
