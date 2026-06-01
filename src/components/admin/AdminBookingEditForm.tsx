"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { toast } from "@/components/ui/use-toast";

type Props = {
  id: string;
  initial: {
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guestComment: string | null;
    guestsCount: number;
  };
  maxCapacity: number;
};

export function AdminBookingEditForm({ id, initial, maxCapacity }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const body = {
      guestName: String(fd.get("guestName") || "").trim(),
      guestEmail: String(fd.get("guestEmail") || "").trim(),
      guestPhone: String(fd.get("guestPhone") || "").trim(),
      guestComment: String(fd.get("guestComment") || "").trim(),
      guestsCount: Number(fd.get("guestsCount") || 1),
    };

    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setSubmitting(false);
    if (!j.ok) {
      toast({
        title: "Ошибка",
        description: j.error || "Не удалось сохранить",
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Бронь обновлена" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Редактировать">
          <Pencil className="w-4 h-4 sm:mr-1" />
          <span className="hidden sm:inline">Редактировать</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Редактирование брони</SheetTitle>
          <SheetDescription>
            Данные гостя. Время, объект и цена не изменяются.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col min-h-0">
          <SheetBody>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Имя гостя</Label>
                <Input
                  name="guestName"
                  defaultValue={initial.guestName}
                  required
                  minLength={2}
                />
              </div>
              <div>
                <Label>Гостей</Label>
                <Input
                  name="guestsCount"
                  type="number"
                  min={1}
                  max={maxCapacity}
                  defaultValue={initial.guestsCount}
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">
                  максимум {maxCapacity}
                </p>
              </div>
              <div>
                <Label>Телефон</Label>
                <Input
                  name="guestPhone"
                  defaultValue={initial.guestPhone}
                  required
                  placeholder="+7..."
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  name="guestEmail"
                  type="email"
                  defaultValue={initial.guestEmail}
                  placeholder="guest@example.com"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Комментарий</Label>
                <Textarea
                  name="guestComment"
                  defaultValue={initial.guestComment ?? ""}
                  rows={3}
                />
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                Отмена
              </Button>
            </SheetClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Сохранение…" : "Сохранить"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
