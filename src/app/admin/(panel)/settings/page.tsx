import { prisma } from "@/lib/db";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { SECRET_KEYS, MASK } from "@/lib/settings-keys";
import { DeployUpdate } from "@/components/admin/DeployUpdate";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const items = await prisma.settings.findMany();
  const map: Record<string, unknown> = {};
  for (const s of items) {
    if (SECRET_KEYS.has(s.key)) {
      // не отдаём реальные секреты в клиентский компонент
      map[s.key] = s.value ? MASK : "";
    } else {
      map[s.key] = s.value;
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Настройки</h1>
      <DeployUpdate />
      <SettingsForm initial={map} />
    </div>
  );
}
