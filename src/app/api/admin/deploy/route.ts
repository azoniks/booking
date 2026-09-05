import { access, open, readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { ok, fail, requireAdmin, unauth } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const directory = path.join(process.cwd(), ".deploy");
const run = promisify(execFile);
let gitCache: { at: number; value: { updateAvailable: boolean; remoteCommit: string | null } } | null = null;

async function exists(file: string) {
  try { await access(file); return true; } catch { return false; }
}

async function state() {
  const enabled = process.platform === "linux" && await exists(path.join(directory, "enabled"));
  const pending = await exists(path.join(directory, "request"));
  const value = await readFile(path.join(directory, "status"), "utf8").catch(() => "idle");
  const status = pending ? "running" : value.trim();
  let git = gitCache && Date.now() - gitCache.at < 60_000 ? gitCache.value : null;
  if (!git) {
    try {
      const [{ stdout: local }, { stdout: remote }] = await Promise.all([
        run("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), timeout: 5000 }),
        run("git", ["ls-remote", "origin", "refs/heads/main"], { cwd: process.cwd(), timeout: 10000 }),
      ]);
      const localCommit = local.trim();
      const remoteCommit = remote.trim().split(/\s+/)[0] || null;
      git = { updateAvailable: Boolean(remoteCommit && localCommit && remoteCommit !== localCommit), remoteCommit };
    } catch {
      git = { updateAvailable: false, remoteCommit: null };
    }
    gitCache = { at: Date.now(), value: git };
  }
  return { enabled, status, ...git };
}

async function authorized() {
  const session = await requireAdmin();
  if (!session?.user?.id) return false;
  const admin = await prisma.adminUser.findUnique({ where: { id: session.user.id }, select: { isActive: true } });
  return admin?.isActive === true;
}

export async function GET() {
  if (!(await authorized())) return unauth();
  return ok(await state());
}

export async function POST(req: Request) {
  if (!(await authorized())) return unauth();
  // Require a same-origin browser request; never accept commands or refs from clients.
  const expected = process.env.APP_URL || process.env.AUTH_URL || req.url;
  if (req.headers.get("origin") !== new URL(expected).origin) return fail("Недопустимый источник запроса", 403);
  const current = await state();
  if (!current.enabled) return fail("Обновление с сервера ещё не настроено", 503);
  try {
    const request = await open(path.join(directory, "request"), "wx", 0o600);
    await request.close();
    return ok({ status: "running" }, 202);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") return fail("Обновление уже выполняется", 409);
    return fail("Не удалось запустить обновление", 500);
  }
}
