"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { AdminGroupCreateForm } from "./AdminGroupCreateForm";

type ObjOption = React.ComponentProps<typeof AdminGroupCreateForm>["objects"];

/**
 * Модальная обёртка над AdminGroupCreateForm для открытия группового заказа
 * прямо с дашборда (без перехода на отдельную страницу). Controlled-режим:
 * open/onOpenChange задаёт родитель; initialDate предзаполняет дату объектов.
 */
export function AdminGroupCreateFormSheet({
  objects,
  open,
  onOpenChange,
  initialDate,
}: {
  objects: ObjOption;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Новый групповой заказ</SheetTitle>
          <SheetDescription>
            Добавьте объекты, задайте каждому даты/время и число гостей. Заказ
            создаётся как единая группа с одним платежом.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          {/* key по initialDate — пересоздаём форму при смене даты, чтобы сбросить
              ранее выбранные объекты и применить новое предзаполнение. */}
          <AdminGroupCreateForm
            key={initialDate ?? "no-date"}
            objects={objects}
            initialDate={initialDate}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
