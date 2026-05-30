import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { richTextToPlain } from "@/lib/sanitize";

export type ObjectCardData = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  media: { id: string; type: string; url: string; isMain: boolean }[];
};

export function ObjectCard({
  obj,
  bookingMode,
  priceFrom,
  capacity,
  hasSlots = false,
}: {
  obj: ObjectCardData;
  bookingMode: "DAILY" | "HOURLY" | "FULL_DAY";
  priceFrom: number;
  capacity: number;
  hasSlots?: boolean;
}) {
  const main = obj.media.find((m) => m.isMain) ?? obj.media[0];
  return (
    <Link href={`/booking/${obj.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
        <div className="aspect-[4/3] bg-slate-100 relative">
          {main ? (
            main.type === "VIDEO" ? (
              <video src={main.url} className="w-full h-full object-cover" muted />
            ) : (
              <img src={main.url} alt={obj.name} className="w-full h-full object-cover" />
            )
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
              нет фото
            </div>
          )}
        </div>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold leading-tight">{obj.name}</h4>
            <div className="flex items-center text-sm text-muted-foreground shrink-0">
              <Users className="w-3 h-3 mr-1" /> до {capacity}
            </div>
          </div>
          {obj.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {richTextToPlain(obj.description)}
            </p>
          )}
          <div className="mt-3 text-sm">
            <span className="font-bold">{priceFrom.toLocaleString("ru-RU")} ₽</span>
            {bookingMode === "DAILY"
              ? "/сутки"
              : bookingMode === "FULL_DAY"
              ? "/день"
              : hasSlots
              ? "/слот"
              : "/час"}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
