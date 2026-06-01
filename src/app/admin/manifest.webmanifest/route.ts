import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const settings = await prisma.settings
    .findMany({ where: { key: { in: ["siteName", "siteLogoUrl"] } } })
    .catch(() => []);
  const map = new Map(settings.map((s) => [s.key, s.value]));
  const siteName = String(map.get("siteName") || "Бронирование");
  const logoUrl = String(map.get("siteLogoUrl") || "");

  const icons = logoUrl
    ? [
        { src: logoUrl, sizes: "any", type: "image/png", purpose: "any" },
        { src: logoUrl, sizes: "any", type: "image/png", purpose: "maskable" },
      ]
    : [];

  const fullName = `Админка — ${siteName}`;

  return NextResponse.json(
    {
      name: fullName,
      short_name: "Админка",
      description: `Панель администратора ${siteName}`,
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      orientation: "portrait",
      background_color: "#f8fafc",
      theme_color: "#ffffff",
      lang: "ru",
      icons,
    },
    {
      headers: {
        "Content-Type": "application/manifest+json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}
