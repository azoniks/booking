import type { Metadata } from "next";
import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { ExternalLink } from "lucide-react";
import { AdminMobileNav } from "@/components/admin/AdminMobileNav";
import { InstallAppHint } from "@/components/client/InstallAppHint";

// Переопределяем манифест на админский, чтобы установка PWA из панели
// давала ярлык на /admin, а не на клиентскую часть (корневой layout).
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

const navItems = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/categories", label: "Категории" },
  { href: "/admin/object-types", label: "Типы объектов" },
  { href: "/admin/objects", label: "Объекты" },
  { href: "/admin/bookings", label: "Брони" },
  { href: "/admin/blocks", label: "Блокировки" },
  { href: "/admin/settings", label: "Настройки" },
  { href: "/admin/admins", label: "Админы" },
];

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  const brandingSettings = await prisma.settings.findMany({
    where: { key: { in: ["siteLogoUrl", "mainSiteUrl", "siteName"] } },
  });
  const branding: Record<string, string> = {};
  for (const s of brandingSettings) branding[s.key] = String(s.value ?? "");
  const logoUrl = branding.siteLogoUrl || "";
  const mainSiteUrl = (branding.mainSiteUrl || "").trim();
  const siteName = branding.siteName || "Админка";

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/admin/login" });
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <AdminMobileNav
        navItems={navItems}
        siteName={siteName}
        logoUrl={logoUrl}
        userEmail={session.user?.email}
        mainSiteUrl={mainSiteUrl}
        signOutAction={signOutAction}
      />
      <aside className="hidden md:flex md:w-64 bg-white border-r md:flex-col md:sticky md:top-0 md:h-screen">
        <div className="p-4 border-b flex items-center gap-3 min-w-0">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={siteName}
              className="h-9 w-9 object-contain shrink-0"
            />
          )}
          <div className="min-w-0">
            <div className="font-semibold truncate">{siteName}</div>
            <div className="text-xs text-muted-foreground truncate">{session.user?.email}</div>
          </div>
        </div>
        <nav className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="px-3 py-2 rounded-md text-sm hover:bg-slate-100 whitespace-nowrap"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-2 border-t flex flex-col gap-2">
          <div className="[&_button]:w-full">
            <InstallAppHint
              siteName={siteName}
              appTitle={`Админка — ${siteName}`}
              dismissKey="installHintDismissed:admin"
            />
          </div>
          {mainSiteUrl && (
            <Button asChild variant="outline" size="sm" className="w-full">
              <a href={mainSiteUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                На основной сайт
              </a>
            </Button>
          )}
          <form action={signOutAction} className="w-full">
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Выйти
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 py-4 md:py-6 overflow-x-auto">{children}</main>
    </div>
  );
}
