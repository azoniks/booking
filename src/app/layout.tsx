import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { prisma } from "@/lib/db";

export async function generateMetadata(): Promise<Metadata> {
  // Favicon = логотип сайта (если загружен в настройках админки).
  // Если не задан — отдаём дефолт из public/.
  const s = await prisma.settings
    .findUnique({ where: { key: "siteLogoUrl" } })
    .catch(() => null);
  const logoUrl = s?.value ? String(s.value) : null;
  return {
    title: "Бронирование — Номера, СПА, Беседки, Мостики",
    description: "Онлайн-бронирование номеров, СПА, беседок и мостиков для рыбалки",
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
