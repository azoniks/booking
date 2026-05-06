import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      <aside className="w-full md:w-64 bg-white border-r flex md:flex-col flex-row md:sticky md:top-0 md:h-screen">
        <div className="p-4 border-b md:border-b border-r md:border-r-0">
          <div className="font-semibold">Админка</div>
          <div className="text-xs text-muted-foreground truncate">{session.user?.email}</div>
        </div>
        <nav className="flex-1 p-2 flex md:flex-col flex-row gap-1 overflow-x-auto md:overflow-x-visible">
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
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/admin/login" });
          }}
          className="p-2 md:border-t border-l md:border-l-0"
        >
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Выйти
          </Button>
        </form>
      </aside>
      <main className="flex-1 p-4 md:p-6 overflow-x-auto">{children}</main>
    </div>
  );
}
