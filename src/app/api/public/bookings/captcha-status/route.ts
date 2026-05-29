import { NextRequest, NextResponse } from "next/server";
import { getCaptchaStatusForIp } from "@/lib/captcha";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req.headers);
  const status = await getCaptchaStatusForIp(ip);
  console.log(
    `[captcha-status] ip=${ip} enabled=${status.enabled} required=${status.required}`,
  );
  return NextResponse.json({
    ok: true,
    data: {
      enabled: status.enabled,
      required: status.required,
      siteKey: status.clientKey,
    },
  });
}
