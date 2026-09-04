import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SiteHeader } from "@/components/client/SiteHeader";
import { BookingForm } from "@/components/client/BookingForm";
import { MediaSlider } from "@/components/client/MediaSlider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Calendar, Sparkles, Tag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BookingPage({ params }: { params: Promise<{ objectId: string }> }) {
  const { objectId } = await params;
  const obj = await prisma.bookingObject.findUnique({
    where: { id: objectId },
    include: {
      objectType: {
        include: {
          category: true,
          media: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
        },
      },
      media: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
      // Аддоны, которые можно добавить к броне этого объекта (напр. трейлер к мостику).
      addons: {
        where: { status: "ACTIVE" },
        include: {
          objectType: { select: { basePrice: true } },
          media: { where: { isMain: true }, take: 1 },
        },
      },
      // Родительские объекты, для которых этот объект является аддоном.
      addonOf: { select: { id: true } },
    },
  });
  if (!obj || obj.status !== "ACTIVE") notFound();

  const t = obj.objectType;
  const mode = t.category.bookingMode;
  const basePrice = Math.round(Number(t.basePrice));

  const facts: { icon: React.ReactNode; text: string }[] = [
    { icon: <Users className="w-4 h-4" />, text: `до ${t.maxCapacity} гостей (включено ${t.baseCapacity})` },
  ];
  if (mode === "DAILY") {
    facts.push({
      icon: <Calendar className="w-4 h-4" />,
      text: `заезд ${t.checkInTime}, выезд ${t.checkOutTime}`,
    });
  } else if (mode === "FULL_DAY") {
    if (t.workingHoursText) facts.push({ icon: <Clock className="w-4 h-4" />, text: t.workingHoursText });
  } else {
    if (t.workingHoursText) facts.push({ icon: <Clock className="w-4 h-4" />, text: t.workingHoursText });
    if (t.minBookingHours) {
      facts.push({
        icon: <Sparkles className="w-4 h-4" />,
        text: `минимум ${t.minBookingHours} ч${t.maxBookingHours ? `, максимум ${t.maxBookingHours} ч` : ""}`,
      });
    }
  }
  if (t.cleaningMinutes > 0) {
    facts.push({
      icon: <Sparkles className="w-4 h-4" />,
      text: `время на уборку ${t.cleaningMinutes} мин`,
    });
  }
  const isSectional = !!(t.sectionsTotal && t.sectionCapacity);
  if (isSectional) {
    const maxSeparate = t.sectionsBookingMax ?? t.sectionsTotal!;
    facts.push({
      icon: <Users className="w-4 h-4" />,
      text: `${t.sectionsTotal} секций × ${t.sectionCapacity} чел. (до ${maxSeparate} секций отдельно, больше — вся площадка)`,
    });
  }
  const unitLabel = isSectional
    ? "секция"
    : mode === "DAILY"
      ? "сутки"
      : mode === "FULL_DAY"
        ? "день"
        : "час";
  const fullVenueNote =
    isSectional && t.fullVenuePrice
      ? ` · вся площадка ${Math.round(Number(t.fullVenuePrice)).toLocaleString("ru-RU")} ₽`
      : "";
  facts.push({
    icon: <Tag className="w-4 h-4" />,
    text: `${basePrice.toLocaleString("ru-RU")} ₽ / ${unitLabel}${fullVenueNote}${
      !isSectional && mode !== "FULL_DAY" && Number(t.extraGuestPrice) > 0
        ? ` · доплата ${Math.round(Number(t.extraGuestPrice))} ₽ за допместо`
        : ""
    }`,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader
        breadcrumbs={[
          {
            label: obj.objectType.category.name,
            href: `/?cat=${obj.objectType.category.slug}`,
          },
          { label: obj.name },
        ]}
      />

      <main className="container py-6 space-y-6">
        {/* Заголовок на всю ширину */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <Badge variant="secondary">{obj.objectType.category.name}</Badge>
            <Badge variant="outline">{obj.objectType.name}</Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{obj.name}</h1>
        </div>

        {/* Двухколоночная раскладка с независимыми высотами колонок.
            Слева: слайдер + описание стопкой. Справа: форма (sticky на десктопе). */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 lg:items-start">
          <div className="space-y-4">
            <MediaSlider
              items={(obj.media.length > 0 ? obj.media : t.media).map((m) => ({
                id: m.id,
                type: m.type,
                url: m.url,
              }))}
              alt={obj.name}
              aspect="16/10"
            />
            <Card>
              <CardHeader>
                <CardTitle>Об объекте</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {obj.description && (
                  <div
                    className="text-sm leading-relaxed [&_p]:my-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-3 [&_h4]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline [&_strong]:font-semibold"
                    dangerouslySetInnerHTML={{ __html: obj.description }}
                  />
                )}
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {facts.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground">
                      <span className="text-foreground mt-0.5">{f.icon}</span>
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="lg:sticky lg:top-20">
            <BookingForm
              object={{
                id: obj.id,
                name: obj.name,
                bookingMode: mode,
                checkInTime: t.checkInTime,
                checkOutTime: t.checkOutTime,
                hourlyStepMinutes: t.hourlyStepMinutes ?? 60,
                workingHoursStart: t.workingHoursStart,
                workingHoursEnd: t.workingHoursEnd,
                minBookingHours: t.minBookingHours ?? 1,
                maxBookingHours: t.maxBookingHours,
                baseCapacity: t.baseCapacity,
                maxCapacity: t.maxCapacity,
                basePrice: Number(t.basePrice),
                extraGuestPrice: Number(t.extraGuestPrice),
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
              }}
              isAddon={obj.isAddon}
              parentIds={obj.addonOf.map((p) => p.id)}
              addons={obj.addons.map((a) => ({
                id: a.id,
                name: a.name,
                basePrice: Number(a.objectType.basePrice),
                imageUrl: a.media[0]?.url ?? null,
              }))}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
