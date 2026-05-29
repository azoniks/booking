import { NextResponse } from "next/server";
import { checkLoginRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ip = getClientIp(req.headers);
  const status = checkLoginRateLimit(`login:${ip}`);
  return NextResponse.json({
    blocked: status.blocked,
    retryAfterSec: status.retryAfterSec,
  });
}
