import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await prisma.settings
    .findMany({ where: { key: { in: ["siteName", "siteLogoUrl"] } } })
    .catch(() => []);
  const map = new Map(settings.map((s) => [s.key, s.value]));
  const siteName = String(map.get("siteName") || "Бронирование");
  const logoUrl = String(map.get("siteLogoUrl") || "");

  const icons: MetadataRoute.Manifest["icons"] = logoUrl
    ? [
        { src: logoUrl, sizes: "any", type: "image/png", purpose: "any" },
        { src: logoUrl, sizes: "any", type: "image/png", purpose: "maskable" },
      ]
    : [];

  return {
    name: siteName,
    short_name: siteName.length > 12 ? siteName.slice(0, 12) : siteName,
    description: "Онлайн-бронирование",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "ru",
    icons,
  };
}
