import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { saveUpload, type MediaType } from "@/lib/upload";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id: objectTypeId } = await params;
    const fd = await req.formData();
    const file = fd.get("file");
    const type = String(fd.get("type") || "IMAGE") as MediaType;

    if (!(file instanceof File)) return fail("file обязателен", 400);

    const t = await prisma.objectType.findUnique({ where: { id: objectTypeId } });
    if (!t) return fail("Тип не найден", 404);

    const { url } = await saveUpload(file, objectTypeId, type, "objectType");
    const lastSort = await prisma.objectTypeMedia.aggregate({
      where: { objectTypeId },
      _max: { sortOrder: true },
    });
    const item = await prisma.objectTypeMedia.create({
      data: {
        objectTypeId,
        type,
        url,
        sortOrder: (lastSort._max.sortOrder ?? -1) + 1,
        isMain: false,
      },
    });
    return ok(item, 201);
  } catch (e) {
    return handleError(e);
  }
}
