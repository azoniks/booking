import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { saveUpload } from "@/lib/upload";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
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
    return ok({ url });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE() {
  if (!(await requireAdmin())) return unauth();
  try {
    await prisma.settings.deleteMany({ where: { key: "siteLogoUrl" } });
    return ok({ removed: true });
  } catch (e) {
    return handleError(e);
  }
}
