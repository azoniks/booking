import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { saveUpload } from "@/lib/upload";
import { recordAudit, actorFromSession } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) return fail("file обязателен", 400);
    const { url } = await saveUpload(file, "site", "IMAGE", "logo");
    await prisma.settings.upsert({
      where: { key: "siteLogoUrl" },
      create: { key: "siteLogoUrl", value: url },
      update: { value: url },
    });
    await recordAudit({
      actor: actorFromSession(session),
      action: "UPDATE",
      entity: "SETTINGS",
      summary: "Загрузил логотип сайта",
      ip: getClientIp(req.headers),
    });
    return ok({ url });
  } catch (e) {
    return handleError(e, { req, action: "Загрузка логотипа" });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return unauth();
  try {
    await prisma.settings.deleteMany({ where: { key: "siteLogoUrl" } });
    await recordAudit({
      actor: actorFromSession(session),
      action: "UPDATE",
      entity: "SETTINGS",
      summary: "Удалил логотип сайта",
      ip: getClientIp(req.headers),
    });
    return ok({ removed: true });
  } catch (e) {
    return handleError(e, { req, action: "Удаление логотипа" });
  }
}
