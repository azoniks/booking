import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomBytes } from "node:crypto";

const ROOT = join(process.cwd(), "public", "uploads");
const ALLOWED = {
  IMAGE: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"],
  VIDEO: [".mp4", ".webm", ".mov"],
  PANO360: [".jpg", ".jpeg", ".png", ".webp"],
};
// Лимиты по типу. У картинок жёстко, у видео — широко, чтобы можно было
// заливать обзорные ролики объектов без перекодирования.
const MAX_SIZE: Record<MediaType, number> = {
  IMAGE: 25 * 1024 * 1024, // 25 MB
  PANO360: 50 * 1024 * 1024, // 50 MB
  VIDEO: 200 * 1024 * 1024, // 200 MB
};

export const MAX_UPLOAD_MB: Record<MediaType, number> = {
  IMAGE: MAX_SIZE.IMAGE / 1024 / 1024,
  PANO360: MAX_SIZE.PANO360 / 1024 / 1024,
  VIDEO: MAX_SIZE.VIDEO / 1024 / 1024,
};

export type MediaType = "IMAGE" | "VIDEO" | "PANO360";

export type UploadKind = "object" | "objectType" | "logo";

export async function saveUpload(
  file: File,
  ownerId: string,
  type: MediaType,
  kind: UploadKind = "object",
): Promise<{ url: string }> {
  const limit = MAX_SIZE[type];
  if (file.size > limit) {
    throw new Error(`Файл больше ${Math.round(limit / 1024 / 1024)} МБ`);
  }
  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED[type].includes(ext)) {
    throw new Error(`Недопустимое расширение для ${type}: ${ext}`);
  }
  const subdir =
    kind === "objectType"
      ? join("types", ownerId)
      : kind === "logo"
        ? "logo"
        : ownerId;
  const dir = join(ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const filename = `${randomBytes(8).toString("hex")}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(join(dir, filename), buf);
  return { url: `/uploads/${subdir.split(/[\\/]/).join("/")}/${filename}` };
}
