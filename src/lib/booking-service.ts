import { prisma } from "./db";
import { findConflicts } from "./availability";
import { calcPrice } from "./pricing";
import { generatePublicCode, generateGroupCode } from "./utils";
import { localDateTimeToUtc } from "./time";
import { addDaysISO } from "./slots";
import { env } from "./env";
import { Prisma, PrepaymentType } from "@prisma/client";

export class BookingConflictError extends Error {
  constructor() {
    super("Объект уже забронирован на выбранный интервал");
    this.name = "BookingConflictError";
  }
}

export class ObjectNotAvailableError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ObjectNotAvailableError";
  }
}

// Гостевые данные, общие для одиночной брони и для всех броней группы.
export interface GuestInfo {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestComment?: string;
}

// Параметры расписания одной брони (без гостевых данных) — для элемента группы.
export interface BookingScheduleArgs {
  objectId: string;
  // Для DAILY: даты в формате YYYY-MM-DD (заезд/выезд). Для HOURLY игнорируется.
  checkInDate?: string;
  checkOutDate?: string;
  // Для HOURLY: ISO datetime. Игнорируется если задан slotId.
  startAt?: string;
  endAt?: string;
  // Для HOURLY со слотами:
  slotId?: string;
  slotDate?: string; // "YYYY-MM-DD"
  // Для FULL_DAY: одна дата YYYY-MM-DD, бронь на весь рабочий день типа.
  bookingDate?: string;
  guestsCount: number;
}

export interface CreateBookingArgs extends BookingScheduleArgs, GuestInfo {}

/**
 * Сколько секций нужно для N гостей. null → не секционный тип.
 * Если нужно больше sectionsBookingMax — бронируется вся площадка (sectionsTotal).
 */
export function calcSectionsNeeded(
  guests: number,
  t: {
    sectionsTotal: number | null;
    sectionCapacity: number | null;
    sectionsBookingMax: number | null;
  },
): number | null {
  if (!t.sectionsTotal || !t.sectionCapacity) return null;
  const max = t.sectionsBookingMax ?? t.sectionsTotal;
  const needed = Math.ceil(guests / t.sectionCapacity);
  if (needed > t.sectionsTotal) {
    throw new Error(
      `Слишком много гостей: максимум ${t.sectionsTotal * t.sectionCapacity}`,
    );
  }
  return needed > max ? t.sectionsTotal : needed;
}

async function loadObjectForBooking(objectId: string) {
  return prisma.bookingObject.findUnique({
    where: { id: objectId },
    include: {
      objectType: { include: { category: true, slots: true } },
    },
  });
}

type LoadedObject = NonNullable<Awaited<ReturnType<typeof loadObjectForBooking>>>;

type PreparedBooking = {
  obj: LoadedObject;
  startAt: Date;
  endAt: Date;
  blockedUntil: Date;
  pricing: ReturnType<typeof calcPrice>;
  prepay: Awaited<ReturnType<typeof resolvePrepayment>>;
  sectionsNeeded: number | null;
  guestsCount: number;
};

/**
 * Подготовка брони: загрузка объекта/типа, резолв времени по режиму,
 * секционная логика, расчёт цены и предоплаты. Read-only — БЕЗ транзакции,
 * чтобы для группы выполнить тяжёлые расчёты до открытия Serializable-транзакции.
 * Проверка конфликтов делается отдельно — в assertAvailable внутри транзакции.
 */
async function prepareBooking(args: BookingScheduleArgs): Promise<PreparedBooking> {
  const obj = await loadObjectForBooking(args.objectId);

  if (!obj) throw new ObjectNotAvailableError("Объект не найден");
  if (obj.status !== "ACTIVE")
    throw new ObjectNotAvailableError("Объект недоступен для бронирования");

  const t = obj.objectType;
  const mode = t.category.bookingMode;

  let startAt: Date, endAt: Date;
  let slotPriceOverride: number | null = null;

  if (mode === "DAILY") {
    if (!args.checkInDate || !args.checkOutDate)
      throw new Error("checkInDate и checkOutDate обязательны для DAILY");
    if (!t.checkInTime || !t.checkOutTime)
      throw new Error("Тип объекта не настроен (нет checkInTime/checkOutTime)");
    startAt = localDateTimeToUtc(args.checkInDate, t.checkInTime);
    endAt = localDateTimeToUtc(args.checkOutDate, t.checkOutTime);
  } else if (mode === "FULL_DAY") {
    if (!args.bookingDate)
      throw new Error("bookingDate обязателен для FULL_DAY");
    if (!t.workingHoursStart || !t.workingHoursEnd)
      throw new Error("Тип объекта не настроен (нет workingHoursStart/End)");
    startAt = localDateTimeToUtc(args.bookingDate, t.workingHoursStart);
    endAt = localDateTimeToUtc(args.bookingDate, t.workingHoursEnd);
  } else if (args.slotId) {
    if (!args.slotDate) throw new Error("slotDate обязателен для slotId");
    const slot = t.slots.find((s) => s.id === args.slotId);
    if (!slot) throw new Error("Слот не найден или относится к другому типу");
    startAt = localDateTimeToUtc(args.slotDate, slot.startTime);
    endAt = localDateTimeToUtc(
      addDaysISO(args.slotDate, slot.endDayOffset),
      slot.endTime,
    );
    slotPriceOverride = slot.priceOverride ? Number(slot.priceOverride) : null;
  } else {
    if (!args.startAt || !args.endAt)
      throw new Error("startAt и endAt обязательны для HOURLY");
    startAt = new Date(args.startAt);
    endAt = new Date(args.endAt);
  }

  if (endAt <= startAt)
    throw new Error("Время окончания должно быть после времени начала");

  // Секционная логика (банкетные площадки): отдельный потолок гостей —
  // sectionsTotal * sectionCapacity. maxCapacity типа в таком случае не
  // используется (он бессмысленен — площадка вмещает всех).
  const sectionsNeeded = calcSectionsNeeded(args.guestsCount, t);

  if (sectionsNeeded === null) {
    if (args.guestsCount < 1 || args.guestsCount > t.maxCapacity)
      throw new Error(
        `Гостей: от 1 до ${t.maxCapacity}`,
      );
  } else if (args.guestsCount < 1) {
    throw new Error("Гостей: минимум 1");
  }

  if (mode === "HOURLY" && !args.slotId) {
    const hours = (endAt.getTime() - startAt.getTime()) / 3_600_000;
    const minH = t.minBookingHours ?? 1;
    if (hours + 1e-9 < minH)
      throw new Error(`Минимальная длительность: ${minH} ч`);
    if (t.maxBookingHours && hours - 1e-9 > t.maxBookingHours)
      throw new Error(`Максимальная длительность: ${t.maxBookingHours} ч`);
  }

  // Pricing: если у слота задан priceOverride — используем его.
  // Если секционная бронь — basePrice × sectionsNeeded (или fullVenuePrice).
  // Иначе — обычный units * basePrice. Доплата за допгостей — всегда (но не для секционных).
  let pricing: ReturnType<typeof calcPrice>;
  if (sectionsNeeded !== null) {
    const isFullVenue = sectionsNeeded === t.sectionsTotal;
    const total =
      isFullVenue && t.fullVenuePrice
        ? new Prisma.Decimal(t.fullVenuePrice)
        : new Prisma.Decimal(t.basePrice).mul(sectionsNeeded);
    pricing = {
      units: sectionsNeeded,
      basePriceTotal: total,
      extraGuests: 0,
      extraGuestsCost: new Prisma.Decimal(0),
      totalPrice: total,
    };
  } else if (slotPriceOverride !== null) {
    const extraGuests = Math.max(0, args.guestsCount - t.baseCapacity);
    const extraCost = new Prisma.Decimal(t.extraGuestPrice).mul(extraGuests);
    const total = new Prisma.Decimal(slotPriceOverride).add(extraCost);
    pricing = {
      units: 1,
      basePriceTotal: new Prisma.Decimal(slotPriceOverride),
      extraGuests,
      extraGuestsCost: extraCost,
      totalPrice: total,
    };
  } else {
    pricing = calcPrice({
      bookingMode: mode,
      startAt,
      endAt,
      basePrice: t.basePrice,
      extraGuestPrice: t.extraGuestPrice,
      guestsCount: args.guestsCount,
      baseCapacity: t.baseCapacity,
      maxCapacity: t.maxCapacity,
    });
  }

  const blockedUntil = new Date(endAt.getTime() + t.cleaningMinutes * 60_000);

  // Предоплата: либо процент (override типа > глобальный > 100%),
  // либо фиксированная сумма (кламп по totalPrice).
  const prepay = await resolvePrepayment(
    {
      paymentType: t.paymentType,
      paymentPercent: t.paymentPercent,
      paymentAmount: t.paymentAmount,
    },
    pricing.totalPrice,
  );

  return {
    obj,
    startAt,
    endAt,
    blockedUntil,
    pricing,
    prepay,
    sectionsNeeded,
    guestsCount: args.guestsCount,
  };
}

/**
 * Проверка доступности подготовленной брони ВНУТРИ транзакции.
 * Бросает BookingConflictError при пересечении с бронью/блокировкой.
 * Можно вызывать несколько раз в одной транзакции (для группы) — уже созданные
 * в этой же транзакции брони видны последующим проверкам.
 */
async function assertAvailable(tx: Prisma.TransactionClient, p: PreparedBooking) {
  const t = p.obj.objectType;
  const conflicts = await findConflicts(tx, {
    objectId: p.obj.id,
    startAt: p.startAt,
    endAt: p.endAt,
    cleaningMinutes: t.cleaningMinutes,
  });
  if (conflicts.blocks.length > 0) throw new BookingConflictError();

  if (p.sectionsNeeded === null) {
    // Несекционный тип — любое пересечение = конфликт.
    if (conflicts.bookings.length > 0) throw new BookingConflictError();
  } else {
    // Секционный тип: считаем занятость по секциям.
    // sectionsBooked === null трактуется как «весь объект» (legacy).
    const sectionsTotal = t.sectionsTotal!;
    const wantFullVenue = p.sectionsNeeded === sectionsTotal;
    const usedByOthers = conflicts.bookings.reduce(
      (sum, b) => sum + (b.sectionsBooked ?? sectionsTotal),
      0,
    );
    if (wantFullVenue && conflicts.bookings.length > 0) {
      throw new BookingConflictError();
    }
    if (usedByOthers + p.sectionsNeeded > sectionsTotal) {
      throw new BookingConflictError();
    }
  }
}

/** Данные для tx.booking.create из подготовленной брони + гостя (+ группа). */
function buildBookingCreateData(
  p: PreparedBooking,
  guest: GuestInfo,
  groupId?: string,
): Prisma.BookingUncheckedCreateInput {
  return {
    publicCode: generatePublicCode(),
    objectId: p.obj.id,
    guestName: guest.guestName.trim(),
    guestEmail: guest.guestEmail.trim().toLowerCase(),
    guestPhone: guest.guestPhone.trim(),
    guestComment: guest.guestComment?.trim() || null,
    startAt: p.startAt,
    endAt: p.endAt,
    blockedUntil: p.blockedUntil,
    guestsCount: p.guestsCount,
    extraGuests: p.pricing.extraGuests,
    basePrice: p.pricing.basePriceTotal,
    extraGuestsCost: p.pricing.extraGuestsCost,
    totalPrice: p.pricing.totalPrice,
    paymentPercent: p.prepay.paymentPercent,
    prepaymentAmount: p.prepay.prepaymentAmount,
    paymentType: p.prepay.paymentType,
    sectionsBooked: p.sectionsNeeded,
    status: "PENDING",
    ...(groupId ? { groupId } : {}),
  };
}

export async function createBooking(args: CreateBookingArgs) {
  const prepared = await prepareBooking(args);
  const guest: GuestInfo = {
    guestName: args.guestName,
    guestEmail: args.guestEmail,
    guestPhone: args.guestPhone,
    guestComment: args.guestComment,
  };
  // Транзакция Serializable: повторно проверяем пересечения и создаём атомарно.
  return prisma.$transaction(
    async (tx) => {
      await assertAvailable(tx, prepared);
      return tx.booking.create({ data: buildBookingCreateData(prepared, guest) });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Групповая бронь: несколько объектов в одном заказе с единым платежом.
 * Гостевые данные общие. Цена/предоплата группы — сумма по всем броням
 * (правила оплаты у разных типов разные, поэтому считаем per-booking).
 * Вся группа создаётся атомарно: при конфликте по любому объекту — откат.
 */
export async function createBookingGroup(
  items: BookingScheduleArgs[],
  guest: GuestInfo,
) {
  if (items.length === 0) throw new Error("Не выбран ни один объект");

  // Тяжёлые расчёты (загрузка, цена, предоплата) — до транзакции.
  const prepared = await Promise.all(items.map((a) => prepareBooking(a)));

  const totalPrice = prepared.reduce(
    (s, p) => s.add(p.pricing.totalPrice),
    new Prisma.Decimal(0),
  );
  const prepaymentAmount = prepared.reduce(
    (s, p) => s.add(p.prepay.prepaymentAmount),
    new Prisma.Decimal(0),
  );

  return prisma.$transaction(
    async (tx) => {
      const group = await tx.bookingGroup.create({
        data: {
          publicCode: generateGroupCode(),
          guestName: guest.guestName.trim(),
          guestEmail: guest.guestEmail.trim().toLowerCase(),
          guestPhone: guest.guestPhone.trim(),
          guestComment: guest.guestComment?.trim() || null,
          totalPrice,
          prepaymentAmount,
          status: "PENDING",
        },
      });

      // Проверяем доступность и создаём по очереди: уже созданная в этой же
      // транзакции бронь видна следующим проверкам (защита от дублей внутри заказа).
      for (const p of prepared) {
        await assertAvailable(tx, p);
        await tx.booking.create({ data: buildBookingCreateData(p, guest, group.id) });
      }

      return tx.bookingGroup.findUniqueOrThrow({
        where: { id: group.id },
        include: { bookings: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

/**
 * Берёт % предоплаты: сначала override на типе объекта,
 * иначе глобальный из Settings.paymentPercent, иначе 100.
 */
export async function resolvePaymentPercent(typeOverride: number | null): Promise<number> {
  if (typeof typeOverride === "number" && typeOverride > 0) {
    return clampPercent(typeOverride);
  }
  const s = await prisma.settings.findUnique({ where: { key: "paymentPercent" } });
  if (s?.value !== undefined && s.value !== null) {
    const v = Number(s.value);
    if (Number.isFinite(v) && v > 0) return clampPercent(v);
  }
  return 100;
}

function clampPercent(v: number): number {
  return Math.max(1, Math.min(100, Math.round(v)));
}

/**
 * Считает предоплату для брони по настройкам типа объекта.
 * Возвращает сумму, тип (PERCENT/FIXED) и эффективный % (для отображения).
 *
 * FIXED: сумма = min(paymentAmount, totalPrice). paymentPercent — производный
 * от amount/total, чтобы существующая логика «split view» (paymentPercent<100)
 * продолжала работать.
 * PERCENT: процент из типа > глобальный из Settings > 100%.
 */
export async function resolvePrepayment(
  type: {
    paymentType: PrepaymentType;
    paymentPercent: number | null;
    paymentAmount: Prisma.Decimal | null;
  },
  totalPrice: Prisma.Decimal,
): Promise<{
  prepaymentAmount: Prisma.Decimal;
  paymentPercent: number;
  paymentType: PrepaymentType;
}> {
  if (type.paymentType === "FIXED" && type.paymentAmount) {
    const fixed = new Prisma.Decimal(type.paymentAmount);
    const amount = fixed.gt(totalPrice) ? totalPrice : fixed;
    const prepaymentAmount = amount.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const percent = totalPrice.gt(0)
      ? clampPercent(
          prepaymentAmount.mul(100).div(totalPrice).toNumber(),
        )
      : 100;
    return { prepaymentAmount, paymentPercent: percent, paymentType: "FIXED" };
  }
  const percent = await resolvePaymentPercent(type.paymentPercent);
  const prepaymentAmount = totalPrice
    .mul(percent)
    .div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { prepaymentAmount, paymentPercent: percent, paymentType: "PERCENT" };
}

/**
 * Отмена просроченных PENDING-броней.
 */
export async function cancelExpiredBookings(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - env.PAYMENT_TIMEOUT_MINUTES * 60_000);
  const result = await prisma.booking.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoff },
    },
    data: {
      status: "CANCELLED",
      cancelReason: "Истёк срок оплаты",
      cancelledAt: now,
    },
  });
  return result.count;
}
