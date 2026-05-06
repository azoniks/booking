"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, Clock, Calendar, Sparkles } from "lucide-react";
import { MediaSlider, type MediaItem } from "./MediaSlider";
import type { ObjectCardData } from "./ObjectCard";

export type ObjectType = {
  id: string;
  name: string;
  description: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  hourlyStepMinutes: number | null;
  workingHoursStart: string | null;
  workingHoursEnd: string | null;
  minBookingHours: number | null;
  maxBookingHours: number | null;
  cleaningMinutes: number;
  baseCapacity: number;
  maxCapacity: number;
  basePrice: string;
  extraGuestPrice: string;
  objects: ObjectCardData[];
};

export type CategoryView = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bookingMode: "DAILY" | "HOURLY";
  objectTypes: ObjectType[];
};

export function CategoryTabs({
  categories,
  initialSlug,
}: {
  categories: CategoryView[];
  initialSlug?: string;
}) {
  // Стейт инициализируется СРАЗУ из initialSlug (приходит с сервера через
  // ?cat=...). Сервер и клиент рендерят одну и ту же вкладку — без вспышки.
  const [active, setActive] = useState(() => {
    if (initialSlug) {
      const found = categories.find((c) => c.slug === initialSlug);
      if (found) return found.id;
    }
    return categories[0]?.id;
  });

  // Реакция на Back/Forward — обновляем активную вкладку из ?cat=...
  useEffect(() => {
    function applyFromUrl() {
      const slug = new URLSearchParams(window.location.search).get("cat");
      if (!slug) return;
      const found = categories.find((c) => c.slug === slug);
      if (found && found.id !== active) setActive(found.id);
    }
    window.addEventListener("popstate", applyFromUrl);
    return () => window.removeEventListener("popstate", applyFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  function handleChange(id: string) {
    setActive(id);
    const cat = categories.find((c) => c.id === id);
    if (cat && typeof window !== "undefined") {
      const u = new URL(window.location.href);
      u.searchParams.set("cat", cat.slug);
      // Не добавляем запись в history — только меняем URL.
      window.history.replaceState(null, "", u.toString());
    }
  }

  if (!categories.length) return null;

  return (
    <Tabs value={active} onValueChange={handleChange} className="w-full">
      <TabsList className="w-full justify-start overflow-x-auto">
        {categories.map((c) => (
          <TabsTrigger
            key={c.id}
            value={c.id}
            className="data-[state=active]:bg-gold data-[state=active]:text-gold-foreground"
          >
            {c.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {categories.map((c) => (
        <TabsContent key={c.id} value={c.id} className="space-y-6">
          {c.description && <p className="text-muted-foreground">{c.description}</p>}
          {c.objectTypes.length === 0 ? (
            <p className="text-muted-foreground">В этой категории пока нет объектов.</p>
          ) : (
            <div className="space-y-6">
              {c.objectTypes.map((t) => (
                <TypeSection key={t.id} type={t} bookingMode={c.bookingMode} />
              ))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function TypeSection({
  type: t,
  bookingMode,
}: {
  type: ObjectType;
  bookingMode: "DAILY" | "HOURLY";
}) {
  const priceFrom = Math.round(Number(t.basePrice));

  // Все медиа всех объектов типа: главные первыми
  const media: MediaItem[] = [];
  for (const o of t.objects) {
    const sorted = [...o.media].sort((a, b) => Number(b.isMain) - Number(a.isMain));
    for (const m of sorted) media.push({ id: m.id, type: m.type, url: m.url });
  }

  const meta: { icon: React.ReactNode; text: string }[] = [
    { icon: <Users className="w-4 h-4" />, text: `до ${t.maxCapacity} гостей` },
  ];
  if (bookingMode === "DAILY") {
    meta.push({
      icon: <Calendar className="w-4 h-4" />,
      text: `заезд ${t.checkInTime}, выезд ${t.checkOutTime}`,
    });
  } else {
    meta.push({
      icon: <Clock className="w-4 h-4" />,
      text:
        t.workingHoursStart && t.workingHoursEnd
          ? `${t.workingHoursStart}–${t.workingHoursEnd}`
          : "круглосуточно",
    });
    if (t.minBookingHours) {
      meta.push({
        icon: <Sparkles className="w-4 h-4" />,
        text: `от ${t.minBookingHours} ч`,
      });
    }
  }
  if (t.cleaningMinutes > 0) {
    meta.push({
      icon: <Sparkles className="w-4 h-4" />,
      text: `уборка ${t.cleaningMinutes} мин`,
    });
  }

  const objects = t.objects;
  const single = objects.length === 1;

  return (
    <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* Слева: инфо + кнопки. На мобиле — после слайдера. */}
        <div className="order-2 lg:order-1 p-6 sm:p-8 flex flex-col gap-4">
          <div>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight">{t.name}</h3>
            {t.description && (
              <p className="text-muted-foreground mt-2 leading-relaxed">{t.description}</p>
            )}
          </div>

          <ul className="space-y-2 text-sm">
            {meta.map((m, i) => (
              <li key={i} className="flex items-center gap-2 text-muted-foreground">
                <span className="text-foreground">{m.icon}</span>
                <span>{m.text}</span>
              </li>
            ))}
            {Number(t.extraGuestPrice) > 0 && (
              <li className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-4 h-4 text-foreground" />
                <span>
                  включено {t.baseCapacity} гост., доплата {Math.round(Number(t.extraGuestPrice))} ₽
                  за допместо
                </span>
              </li>
            )}
          </ul>

          <div className="mt-auto pt-4 border-t flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm text-muted-foreground">Стоимость</span>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">от</span>{" "}
                <span className="text-2xl font-bold tracking-tight text-gold">
                  {priceFrom.toLocaleString("ru-RU")} ₽
                </span>
                <span className="text-sm text-muted-foreground ml-1">
                  /{bookingMode === "DAILY" ? "сутки" : "час"}
                </span>
              </div>
            </div>

            {objects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока нет доступных объектов.</p>
            ) : single ? (
              <Button asChild size="lg" className="w-full">
                <Link href={`/booking/${objects[0].id}`}>Забронировать</Link>
              </Button>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Доступные объекты ({objects.length}):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {objects.map((o) => (
                    <Button
                      key={o.id}
                      asChild
                      variant="outline"
                      className="justify-between h-auto py-3"
                    >
                      <Link href={`/booking/${o.id}`}>
                        <span className="truncate">{o.name}</span>
                        <span className="text-xs text-muted-foreground">→</span>
                      </Link>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Справа: слайдер */}
        <div className="order-1 lg:order-2 p-3 sm:p-4 lg:p-5 flex items-center bg-slate-50/50">
          <div className="w-full">
            <MediaSlider items={media} alt={t.name} aspect="4/3" />
          </div>
        </div>
      </div>
    </section>
  );
}
