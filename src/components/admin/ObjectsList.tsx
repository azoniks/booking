"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ObjectsCreateForm } from "./ObjectsCreateForm";

type Category = { id: string; name: string };

type ObjectItem = {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "HIDDEN" | "MAINTENANCE";
  sortOrder: number;
  categoryId: string;
  categoryName: string;
  typeName: string;
  bookingsCount: number;
  mediaCount: number;
};

type TypeItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
};

export function ObjectsList({
  objects,
  types,
  categories,
}: {
  objects: ObjectItem[];
  types: TypeItem[];
  categories: Category[];
}) {
  const [activeCat, setActiveCat] = useState<string>("ALL");
  const visibleObjects =
    activeCat === "ALL"
      ? objects
      : objects.filter((o) => o.categoryId === activeCat);
  const visibleTypes =
    activeCat === "ALL" ? types : types.filter((t) => t.categoryId === activeCat);

  return (
    <div className="space-y-4">
      {categories.length > 0 && (
        <Tabs value={activeCat} onValueChange={setActiveCat}>
          <TabsList>
            <TabsTrigger value="ALL">Все ({objects.length})</TabsTrigger>
            {categories.map((c) => {
              const count = objects.filter((o) => o.categoryId === c.id).length;
              return (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.name} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      <ObjectsCreateForm types={visibleTypes} />

      <div className="grid gap-3">
        {visibleObjects.map((o) => (
          <Card key={o.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{o.name}</span>
                  <Badge variant="secondary">{o.categoryName}</Badge>
                  <Badge variant="outline">{o.typeName}</Badge>
                  <StatusPill status={o.status} />
                  <span className="text-xs text-muted-foreground">/{o.slug}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Броней: {o.bookingsCount} · Медиа: {o.mediaCount} · Порядок: {o.sortOrder}
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
        {visibleObjects.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {activeCat === "ALL" ? "Объектов пока нет" : "В этой категории нет объектов"}
          </p>
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
