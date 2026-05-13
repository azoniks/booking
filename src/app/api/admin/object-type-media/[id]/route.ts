import { NextRequest } from "next/server";
import { unlink } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { ok, handleError, requireAdmin, unauth } from "@/lib/api-utils";
import { z } from "zod";

const patchSchema = z.object({
  isMain: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    if (body.isMain) {
      const m = await prisma.objectTypeMedia.findUnique({ where: { id } });
      if (m) {
        await prisma.objectTypeMedia.updateMany({
          where: { objectTypeId: m.objectTypeId },
          data: { isMain: false },
        });
      }
    }
    const updated = await prisma.objectTypeMedia.update({ where: { id }, data: body });
    return ok(updated);
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return unauth();
  try {
    const { id } = await params;
    const m = await prisma.objectTypeMedia.findUnique({ where: { id } });
    if (m) {
      const rel = m.url.replace(/^\/uploads\//, "");
      try {
        await unlink(join(process.cwd(), "public", "uploads", rel));
      } catch {
        // ignore
      }
      await prisma.objectTypeMedia.delete({ where: { id } });
    }
    return ok({ id });
  } catch (e) {
    return handleError(e);
  }
}
