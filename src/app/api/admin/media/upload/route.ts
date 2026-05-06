import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { ok, fail, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { saveUpload, type MediaType } from "@/lib/upload";

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return unauth();
  try {
    const fd = await req.formData();
    const file = fd.get("file");
    const objectId = String(fd.get("objectId") || "");
    const type = String(fd.get("type") || "IMAGE") as MediaType;

    if (!(file instanceof File)) return fail("file обязателен", 400);
    if (!objectId) return fail("objectId обязателен", 400);

    const obj = await prisma.bookingObject.findUnique({ where: { id: objectId } });
    if (!obj) return fail("Объект не найден", 404);

    const { url } = await saveUpload(file, objectId, type);
    const lastSort = await prisma.objectMedia.aggregate({
      where: { objectId },
      _max: { sortOrder: true },
    });
    const item = await prisma.objectMedia.create({
      data: {
        objectId,
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
