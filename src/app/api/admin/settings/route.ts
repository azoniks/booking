import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { settingsUpdateSchema } from "@/lib/validators";
import { SECRET_KEYS, MASK, isMaskOrEmpty } from "@/lib/settings-keys";
import { invalidateBookingRateLimitCache } from "@/lib/rate-limit";
import { invalidateCaptchaConfigCache } from "@/lib/captcha";

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
  if (!(await requireAdmin())) return unauth();
  try {
    const body = settingsUpdateSchema.parse(await req.json());
    let updated = 0;
    for (const [key, value] of Object.entries(body)) {
      if (SECRET_KEYS.has(key) && isMaskOrEmpty(value)) continue;
      await prisma.settings.upsert({
        where: { key },
        create: { key, value: value as object },
        update: { value: value as object },
      });
      updated++;
    }
    invalidateBookingRateLimitCache();
    invalidateCaptchaConfigCache();
    return ok({ updated });
  } catch (e) {
    return handleError(e);
  }
}
