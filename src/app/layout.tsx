import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { CartProvider } from "@/components/client/CartProvider";
import { SiteConfigProvider } from "@/components/client/SiteConfigProvider";
import { CookieConsentBanner } from "@/components/client/CookieConsentBanner";
import { prisma } from "@/lib/db";

const DEFAULT_COOKIE_TEXT =
  "Мы используем cookie для корректной работы сайта. Продолжая пользоваться сайтом, вы соглашаетесь с обработкой файлов cookie.";
const DEFAULT_COOKIE_RESHOW_DAYS = 180;

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  // Favicon = логотип сайта (если загружен в настройках админки).
  // Если не задан — отдаём дефолт из public/.
  const [logo, name] = await Promise.all([
    prisma.settings.findUnique({ where: { key: "siteLogoUrl" } }).catch(() => null),
    prisma.settings.findUnique({ where: { key: "siteName" } }).catch(() => null),
  ]);
  const logoUrl = logo?.value ? String(logo.value) : null;
  const siteName = name?.value ? String(name.value) : "Бронирование";
  return {
    title: "Бронирование — Номера, СПА, Беседки, Мостики",
    description: "Онлайн-бронирование номеров, СПА, беседок и мостиков для рыбалки",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: siteName,
    },
    icons: logoUrl
      ? { icon: logoUrl, shortcut: logoUrl, apple: logoUrl }
      : undefined,
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Публичные настройки для клиента: ссылки на документы + кук-баннер + шапка.
  const keys = [
    "privacyPolicyUrl",
    "personalDataUrl",
    "cookieBannerEnabled",
    "cookieBannerText",
    "cookieBannerReshowDays",
    "siteName",
    "siteLogoUrl",
    "siteContact",
    "mainSiteUrl",
  ];
  const rows = await prisma.settings
    .findMany({ where: { key: { in: keys } } })
    .catch(() => []);
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const str = (k: string) => {
    const v = map.get(k);
    return v === null || v === undefined ? "" : String(v);
  };

  const privacyPolicyUrl = str("privacyPolicyUrl");
  const personalDataUrl = str("personalDataUrl");
  const siteName = str("siteName") || "Бронирование";
  const siteLogoUrl = str("siteLogoUrl");
  const siteContact = str("siteContact");
  const mainSiteUrl = str("mainSiteUrl").trim();
  const cookieBannerEnabled = str("cookieBannerEnabled") === "true";
  const cookieBannerText = str("cookieBannerText") || DEFAULT_COOKIE_TEXT;
  const reshowRaw = Number(str("cookieBannerReshowDays"));
  const cookieBannerReshowDays =
    Number.isFinite(reshowRaw) && reshowRaw > 0 ? reshowRaw : DEFAULT_COOKIE_RESHOW_DAYS;

  return (
    <html lang="ru">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SiteConfigProvider
          value={{
            privacyPolicyUrl,
            personalDataUrl,
            siteName,
            siteLogoUrl,
            siteContact,
            mainSiteUrl,
          }}
        >
          <CartProvider>{children}</CartProvider>
        </SiteConfigProvider>
        <CookieConsentBanner
          enabled={cookieBannerEnabled}
          text={cookieBannerText}
          reshowDays={cookieBannerReshowDays}
        />
        <Toaster />
      </body>
    </html>
  );
}
