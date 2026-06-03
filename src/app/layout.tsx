import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { CartProvider } from "@/components/client/CartProvider";
import { prisma } from "@/lib/db";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <CartProvider>{children}</CartProvider>
        <Toaster />
      </body>
    </html>
  );
}
