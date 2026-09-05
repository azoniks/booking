import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), admin: vi.fn(), access: vi.fn(), open: vi.fn(), readFile: vi.fn(), execFile: vi.fn(),
}));
vi.mock("node:fs/promises", () => ({ access: mocks.access, open: mocks.open, readFile: mocks.readFile }));
vi.mock("node:child_process", () => ({ execFile: mocks.execFile }));
vi.mock("@/lib/db", () => ({ prisma: { adminUser: { findUnique: mocks.admin } } }));
vi.mock("@/lib/api-utils", () => ({
  requireAdmin: mocks.auth,
  ok: (data: unknown, status = 200) => Response.json({ ok: true, data }, { status }),
  fail: (error: string, status = 400) => Response.json({ ok: false, error }, { status }),
  unauth: () => Response.json({ ok: false }, { status: 401 }),
}));
import { GET, POST } from "@/app/api/admin/deploy/route";

const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;
const request = (origin = "https://booking.example.ru") => new Request(`${origin}/api/admin/deploy`, {
  method: "POST", headers: { origin },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("APP_URL", "https://booking.example.ru");
  Object.defineProperty(process, "platform", { value: "linux" });
  mocks.auth.mockResolvedValue({ user: { id: "admin-1" } });
  mocks.admin.mockResolvedValue({ isActive: true });
  mocks.access.mockImplementation(async (file: string) => {
    if (file.endsWith("request")) throw new Error("ENOENT");
  });
  mocks.readFile.mockResolvedValue("success\n");
  mocks.open.mockResolvedValue({ close: vi.fn().mockResolvedValue(undefined) });
  mocks.execFile.mockImplementation((_command: string, args: string[], _options: unknown, callback: (error: null, result: { stdout: string; stderr: string }) => void) => {
    callback(null, { stdout: args[0] === "rev-parse" ? "local\n" : "local\trefs/heads/main\n", stderr: "" });
  });
});
afterEach(() => {
  Object.defineProperty(process, "platform", originalPlatform);
  vi.unstubAllEnvs();
});

describe("admin deployment", () => {
  it("rejects unauthenticated requests without touching the filesystem", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect((await GET()).status).toBe(401);
    expect(mocks.access).not.toHaveBeenCalled();
  });
  it("rejects a deactivated administrator", async () => {
    mocks.admin.mockResolvedValue({ isActive: false });
    expect((await POST(request())).status).toBe(401);
  });
  it("rejects cross-origin deployment requests", async () => {
    expect((await POST(request("https://other.example"))).status).toBe(403);
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it("does not start before server setup", async () => {
    mocks.access.mockRejectedValue(new Error("ENOENT"));
    expect((await POST(request())).status).toBe(503);
    expect(mocks.open).not.toHaveBeenCalled();
  });
  it("creates an exclusive request and rejects concurrent starts", async () => {
    expect((await POST(request())).status).toBe(202);
    expect(mocks.open).toHaveBeenCalledWith(expect.stringContaining(".deploy/request"), "wx", 0o600);
    mocks.open.mockRejectedValue(Object.assign(new Error("exists"), { code: "EEXIST" }));
    expect((await POST(request())).status).toBe(409);
  });
  it("reports an outstanding request instead of the previous success", async () => {
    mocks.access.mockResolvedValue(undefined);
    expect((await GET()).status).toBe(200);
  });
  it("reports the persisted result after restart", async () => {
    expect((await GET()).status).toBe(200);
  });
});
