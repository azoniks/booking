import { Prisma } from "@prisma/client";

export interface PricingInput {
  bookingMode: "DAILY" | "HOURLY" | "FULL_DAY";
  startAt: Date;
  endAt: Date;
  basePrice: Prisma.Decimal | number | string;
  extraGuestPrice: Prisma.Decimal | number | string;
  guestsCount: number;
  baseCapacity: number;
  maxCapacity: number;
}

export interface PricingResult {
  units: number; // суток или часов
  basePriceTotal: Prisma.Decimal;
  extraGuests: number;
  extraGuestsCost: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export function calcPrice(input: PricingInput): PricingResult {
  if (input.endAt <= input.startAt) {
    throw new Error("endAt must be after startAt");
  }
  if (input.guestsCount > input.maxCapacity) {
    throw new Error(
      `guestsCount ${input.guestsCount} exceeds maxCapacity ${input.maxCapacity}`,
    );
  }

  const base = new Prisma.Decimal(input.basePrice);

  // FULL_DAY — фиксированная цена за день, без множителя и без доплат
  // за дополнительных гостей (бронь беседки целиком на день).
  if (input.bookingMode === "FULL_DAY") {
    return {
      units: 1,
      basePriceTotal: base,
      extraGuests: 0,
      extraGuestsCost: new Prisma.Decimal(0),
      totalPrice: base,
    };
  }

  const ms = input.endAt.getTime() - input.startAt.getTime();
  const units =
    input.bookingMode === "DAILY"
      ? Math.max(1, Math.ceil(ms / DAY_MS))
      : Math.max(1, Math.ceil(ms / HOUR_MS));

  const extraPrice = new Prisma.Decimal(input.extraGuestPrice);

  const basePriceTotal = base.mul(units);
  const extraGuests = Math.max(0, input.guestsCount - input.baseCapacity);
  const extraGuestsCost = extraPrice.mul(extraGuests).mul(units);
  const totalPrice = basePriceTotal.add(extraGuestsCost);

  return {
    units,
    basePriceTotal,
    extraGuests,
    extraGuestsCost,
    totalPrice,
  };
}
