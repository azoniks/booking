import type { Metadata } from "next";
import { prisma } from "@/lib/db";

// Страница логина — клиентский компонент и не может экспортировать metadata,
// поэтому манифест переопределяем здесь: установка PWA со страницы входа
// должна давать ярлык на админку (/admin), а не на клиентскую часть.
export async function generateMetadata(): Promise<Metadata> {
  const s = await prisma.settings
    .findUnique({ where: { key: "siteName" } })
    .catch(() => null);
  const siteName = s?.value ? String(s.value) : "Бронирование";
  return {
    manifest: "/admin/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: `Админка — ${siteName}`,
    },
  };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
