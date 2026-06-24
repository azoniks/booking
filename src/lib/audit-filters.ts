import type { Prisma, AuditAction, AuditEntity } from "@prisma/client";

// RU-подписи для разделов (entity) и действий (action) — используются и в
// списке логов, и в селекторах фильтра.
export const ENTITY_LABELS: Record<AuditEntity, string> = {
  BOOKING: "Бронь",
  BOOKING_GROUP: "Заказ",
  OBJECT: "Объект",
  OBJECT_TYPE: "Тип объекта",
  CATEGORY: "Категория",
  SLOT: "Слот",
  BLOCK: "Блокировка",
  SETTINGS: "Настройки",
  ADMIN: "Админ",
  AUTH: "Авторизация",
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: "Создание",
  UPDATE: "Изменение",
  DELETE: "Удаление",
  CANCEL: "Отмена",
  REFUND: "Возврат",
  LOGIN: "Вход",
  LOGOUT: "Выход",
};

export const ENTITY_VALUES = Object.keys(ENTITY_LABELS) as AuditEntity[];
export const ACTION_VALUES = Object.keys(ACTION_LABELS) as AuditAction[];

export type AuditFilterParams = {
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  entity?: string; // AuditEntity
  action?: string; // AuditAction
  actor?: string; // actorId
};

/** Строит Prisma-условие выборки логов по фильтрам. */
export function buildAuditWhere(p: AuditFilterParams): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (p.entity && (ENTITY_VALUES as string[]).includes(p.entity)) {
    where.entity = p.entity as AuditEntity;
  }
  if (p.action && (ACTION_VALUES as string[]).includes(p.action)) {
    where.action = p.action as AuditAction;
  }
  if (p.actor) where.actorId = p.actor;

  if (p.from || p.to) {
    const range: Prisma.DateTimeFilter = {};
    if (p.from) range.gte = new Date(p.from + "T00:00:00Z");
    if (p.to) range.lte = new Date(p.to + "T23:59:59Z");
    where.createdAt = range;
  }

  return where;
}

/** Число активных фильтров — для бейджа на кнопке «Фильтры» (моб.). */
export function countActiveAuditFilters(p: AuditFilterParams): number {
  let n = 0;
  if (p.entity) n++;
  if (p.action) n++;
  if (p.actor) n++;
  if (p.from || p.to) n++;
  return n;
}
