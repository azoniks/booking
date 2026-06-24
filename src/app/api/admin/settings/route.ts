import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { settingsUpdateSchema } from "@/lib/validators";
import { SECRET_KEYS, MASK, isMaskOrEmpty } from "@/lib/settings-keys";
import { invalidateBookingRateLimitCache, getClientIp } from "@/lib/rate-limit";
import { invalidateCaptchaConfigCache } from "@/lib/captcha";
import { recordAudit, actorFromSession } from "@/lib/audit";

export async function GET() {
  if (!(await requireAdmin())) return unauth();
  const items = await prisma.settings.findMany();
  const map: Record<string, unknown> = {};
  for (const s of items) {
    if (SECRET_KEYS.has(s.key)) {
      map[s.key] = s.value ? MASK : "";
    } else {
      map[s.key] = s.value;
    }
  }
  return ok(map);
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const body = settingsUpdateSchema.parse(await req.json());
    let updated = 0;
    const changedKeys: string[] = [];
    for (const [key, value] of Object.entries(body)) {
      if (SECRET_KEYS.has(key) && isMaskOrEmpty(value)) continue;
      await prisma.settings.upsert({
        where: { key },
        create: { key, value: value as object },
        update: { value: value as object },
      });
      updated++;
      changedKeys.push(key);
    }
    invalidateBookingRateLimitCache();
    invalidateCaptchaConfigCache();
    if (updated > 0) {
      await recordAudit({
        actor: actorFromSession(session),
        action: "UPDATE",
        entity: "SETTINGS",
        // Секретные ключи в meta не пишем — только их имена.
        summary: `Изменил настройки: ${changedKeys.join(", ")}`,
        meta: { keys: changedKeys },
        ip: getClientIp(req.headers),
      });
    }
    return ok({ updated });
  } catch (e) {
    return handleError(e, { req, action: "Изменение настроек" });
  }
}
