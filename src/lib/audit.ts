import type { Session } from "next-auth";
import type { AuditAction, AuditEntity, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AuditActor = {
  id?: string | null;
  name?: string | null;
  email?: string | null;
};

/** Достаёт автора из сессии requireAdmin(); id проставляется в auth.config.ts. */
export function actorFromSession(session: Session | null): AuditActor {
  const u = session?.user as
    | { id?: string; name?: string | null; email?: string | null }
    | undefined;
  return { id: u?.id ?? null, name: u?.name ?? null, email: u?.email ?? null };
}

/**
 * Записывает событие аудита. Никогда не бросает — сбой логирования не должен
 * ломать само действие администратора. Вызывать с await перед возвратом ответа
 * (в serverless после ответа выполнение может быть заморожено).
 */
export async function recordAudit(input: {
  actor: AuditActor;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  summary: string;
  // Любые детали — коэрцируются к чистому JSON (Date→строка, Decimal→строка).
  meta?: unknown;
  ip?: string | null;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actor.id ?? null,
        actorName: input.actor.name?.trim() || "—",
        actorEmail: input.actor.email?.trim() || "—",
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        summary: input.summary,
        meta: toJson(input.meta),
        ip: input.ip ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] не удалось записать событие", e);
  }
}

// Приводит произвольное значение к JSON, пригодному для Prisma Json-поля.
// Возвращает undefined (поле не пишется), если значения нет или сериализация
// невозможна.
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

/**
 * Возвращает только реально изменившиеся поля как { поле: { from, to } }.
 * Сравнение нестрогое по значению через JSON (числа/строки/Decimal-строки).
 * Удобно складывать в meta для UPDATE-событий.
 */
export function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  keys: (keyof T)[],
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    if (!(key in after)) continue;
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      diff[String(key)] = { from: a ?? null, to: b ?? null };
    }
  }
  return diff;
}
