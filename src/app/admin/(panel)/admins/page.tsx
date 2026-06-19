import { prisma } from "@/lib/db";
import { AdminsManager } from "@/components/admin/AdminsManager";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const session = await auth();
  const items = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, isActive: true, lastLoginAt: true },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold px-4 md:px-6">Администраторы</h1>
      <AdminsManager
        initial={items.map((a) => ({
          ...a,
          lastLoginAt: a.lastLoginAt ? a.lastLoginAt.toISOString() : null,
        }))}
        currentUserId={(session?.user as { id?: string } | undefined)?.id ?? null}
      />
    </div>
  );
}
