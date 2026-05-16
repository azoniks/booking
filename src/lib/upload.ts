import { mkdir, writeFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomBytes } from "node:crypto";

const ROOT = join(process.cwd(), "public", "uploads");
const ALLOWED = {
  IMAGE: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"],
  VIDEO: [".mp4", ".webm", ".mov"],
  PANO360: [".jpg", ".jpeg", ".png", ".webp"],
};
const MAX_SIZE = 25 * 1024 * 1024; // 25MB

export type MediaType = "IMAGE" | "VIDEO" | "PANO360";

export type UploadKind = "object" | "objectType" | "logo";

export async function saveUpload(
  file: File,
  ownerId: string,
  type: MediaType,
  kind: UploadKind = "object",
): Promise<{ url: string }> {
  if (file.size > MAX_SIZE) {
    throw new Error(`Файл больше ${MAX_SIZE / 1024 / 1024} МБ`);
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
