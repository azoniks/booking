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

  // Если для почасового типа настроены слоты, интервал должен определяться
  // только выбранным слотом. Проверяем это на сервере, чтобы произвольные
  // startAt/endAt нельзя было передать в обход клиентской или админской формы.
  if (mode === "HOURLY" && t.slots.length > 0 && !args.slotId) {
    throw new Error("Для этого объекта необходимо выбрать слот");
  }

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
async function assertAvailable(
  tx: Prisma.TransactionClient,
  p: PreparedBooking,
  excludeBookingId?: string,
) {
  const t = p.obj.objectType;
  const conflicts = await findConflicts(tx, {
    objectId: p.obj.id,
    startAt: p.startAt,
    endAt: p.endAt,
    cleaningMinutes: t.cleaningMinutes,
    excludeBookingId,
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
  createdByAdmin = false,
): Prisma.BookingUncheckedCreateInput {
  return {
    createdByAdmin,
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

export async function createBooking(
  args: CreateBookingArgs,
  opts: { createdByAdmin?: boolean } = {},
) {
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
      return tx.booking.create({
        data: buildBookingCreateData(prepared, guest, undefined, opts.createdByAdmin ?? false),
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

// Параметры переноса брони: поля расписания (по режиму) + число гостей.
export interface RescheduleArgs {
  checkInDate?: string;
  checkOutDate?: string;
  startAt?: string;
  endAt?: string;
  slotId?: string;
  slotDate?: string;
  bookingDate?: string;
  guestsCount: number;
}

/**
 * Перенос существующей брони на новые дату/время. Объект не меняется.
 * Пересчитывает startAt/endAt/blockedUntil и цену/предоплату по новым датам
 * (как при создании), проверяет пересечения, исключая саму бронь. Если бронь
 * входит в заказ — пересчитывает итоги заказа.
 */
export async function rescheduleBooking(bookingId: string, schedule: RescheduleArgs) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, objectId: true, groupId: true },
  });
  if (!booking) throw new ObjectNotAvailableError("Бронь не найдена");

  const prepared = await prepareBooking({
    objectId: booking.objectId,
    checkInDate: schedule.checkInDate,
    checkOutDate: schedule.checkOutDate,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    slotId: schedule.slotId,
    slotDate: schedule.slotDate,
    bookingDate: schedule.bookingDate,
    guestsCount: schedule.guestsCount,
  });

  return prisma.$transaction(
    async (tx) => {
      await assertAvailable(tx, prepared, bookingId);
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: {
          startAt: prepared.startAt,
          endAt: prepared.endAt,
          blockedUntil: prepared.blockedUntil,
          guestsCount: prepared.guestsCount,
          extraGuests: prepared.pricing.extraGuests,
          basePrice: prepared.pricing.basePriceTotal,
          extraGuestsCost: prepared.pricing.extraGuestsCost,
          totalPrice: prepared.pricing.totalPrice,
          prepaymentAmount: prepared.prepay.prepaymentAmount,
          paymentPercent: prepared.prepay.paymentPercent,
          paymentType: prepared.prepay.paymentType,
          sectionsBooked: prepared.sectionsNeeded,
        },
      });

      // Бронь в составе заказа — пересчитываем итоги заказа по всем его броням.
      if (booking.groupId) {
        const groupBookings = await tx.booking.findMany({
          where: { groupId: booking.groupId },
          select: { totalPrice: true, prepaymentAmount: true },
        });
        const totalPrice = groupBookings.reduce(
          (s, b) => s.add(b.totalPrice),
          new Prisma.Decimal(0),
        );
        const prepaymentAmount = groupBookings.reduce(
          (s, b) => s.add(b.prepaymentAmount),
          new Prisma.Decimal(0),
        );
        await tx.bookingGroup.update({
          where: { id: booking.groupId },
          data: { totalPrice, prepaymentAmount },
        });
      }

      return updated;
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
  opts: { createdByAdmin?: boolean } = {},
) {
  if (items.length === 0) throw new Error("Не выбран ни один объект");
  const createdByAdmin = opts.createdByAdmin ?? false;

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
          createdByAdmin,
        },
      });

      // Проверяем доступность и создаём по очереди: уже созданная в этой же
      // транзакции бронь видна следующим проверкам (защита от дублей внутри заказа).
      for (const p of prepared) {
        await assertAvailable(tx, p);
        await tx.booking.create({
          data: buildBookingCreateData(p, guest, group.id, createdByAdmin),
        });
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

// Окно «скоро отменится»: PENDING, до конца срока осталось ≤ REMINDER_BEFORE
// минут, но срок ещё не истёк. Группы и одиночные брони ищем раздельно
// (у заказа уведомление одно на всю группу).
function expiryReminderWindow(now: Date) {
  const remindAt = new Date(
    now.getTime() -
      (env.PAYMENT_TIMEOUT_MINUTES - env.PAYMENT_REMINDER_BEFORE_MINUTES) * 60_000,
  );
  const expireAt = new Date(now.getTime() - env.PAYMENT_TIMEOUT_MINUTES * 60_000);
  return { remindAt, expireAt };
}

export async function findExpiringPendingBookings(now: Date = new Date()) {
  const { remindAt, expireAt } = expiryReminderWindow(now);
  return prisma.booking.findMany({
    where: {
      status: "PENDING",
      groupId: null, // групповые брони напоминаем на уровне заказа
      createdByAdmin: false, // ручные брони онлайн не оплачивают — не напоминаем
      createdAt: { lte: remindAt, gt: expireAt },
    },
    select: { id: true },
  });
}

export async function findExpiringPendingGroups(now: Date = new Date()) {
  const { remindAt, expireAt } = expiryReminderWindow(now);
  return prisma.bookingGroup.findMany({
    where: {
      status: "PENDING",
      createdByAdmin: false,
      createdAt: { lte: remindAt, gt: expireAt },
    },
    select: { id: true },
  });
}

/**
 * Отмена просроченных PENDING-броней. Отменяет ТОЛЬКО клиентские брони
 * (createdByAdmin = false) — ручные брони администратора авто-отмене не
 * подлежат. Возвращает id отменённых броней, чтобы вызывающий разослал
 * уведомления гостям.
 */
export async function cancelExpiredBookings(now: Date = new Date()): Promise<string[]> {
  const cutoff = new Date(now.getTime() - env.PAYMENT_TIMEOUT_MINUTES * 60_000);
  const expired = await prisma.booking.findMany({
    where: {
      status: "PENDING",
      createdByAdmin: false,
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });
  if (expired.length === 0) return [];
  const ids = expired.map((b) => b.id);
  await prisma.booking.updateMany({
    where: { id: { in: ids } },
    data: {
      status: "CANCELLED",
      cancelReason: "Истёк срок оплаты",
      cancelledAt: now,
    },
  });
  return ids;
}

// Статусы, из которых бронь авто-закрывается в COMPLETED: оплачена полностью
// (PAID) или внесён аванс (PREPAID). Другие статусы автомат не трогает.
const AUTOCOMPLETE_FROM_STATUSES = ["PREPAID", "PAID"] as const;

/**
 * Авто-закрытие завершённых оплаченных броней. Бронь переводится в COMPLETED,
 * если:
 *  - её статус PREPAID (аванс внесён) или PAID (оплачена полностью), и другого
 *    статуса не выставляли;
 *  - с момента окончания брони (endAt) прошло не меньше
 *    AUTOCOMPLETE_AFTER_MINUTES (по умолчанию 4 часа).
 * Возвращает id закрытых броней. Условие статуса дублируется в updateMany на
 * случай гонки: если статус успел измениться между выборкой и обновлением,
 * такая бронь не будет затронута.
 */
export async function completeFinishedPrepaidBookings(
  now: Date = new Date(),
): Promise<string[]> {
  const cutoff = new Date(now.getTime() - env.AUTOCOMPLETE_AFTER_MINUTES * 60_000);
  const finished = await prisma.booking.findMany({
    where: {
      status: { in: [...AUTOCOMPLETE_FROM_STATUSES] },
      endAt: { lte: cutoff },
    },
    select: { id: true },
  });
  if (finished.length === 0) return [];
  const ids = finished.map((b) => b.id);
  await prisma.booking.updateMany({
    where: { id: { in: ids }, status: { in: [...AUTOCOMPLETE_FROM_STATUSES] } },
    data: { status: "COMPLETED" },
  });
  return ids;
}
