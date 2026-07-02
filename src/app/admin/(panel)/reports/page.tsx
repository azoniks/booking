import { prisma } from "@/lib/db";
import { formatRub } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ReportFilters } from "@/components/admin/ReportFilters";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Статусы, которые считаются доходом (идут в оборот, предоплаты и разбивку по
// типам). Остальные (PENDING, NO_SHOW, CANCELLED) в денежные метрики не входят.
const REVENUE_STATUSES = new Set<string>(["PREPAID", "PAID", "COMPLETED"]);

const STATUS_ORDER = ["PENDING", "PREPAID", "PAID", "COMPLETED", "NO_SHOW", "CANCELLED"] as const;
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Ожидают",
  PREPAID: "Аванс внесён",
  PAID: "Оплачены",
  COMPLETED: "Завершены",
  NO_SHOW: "Не пришёл",
  CANCELLED: "Отменены",
};
const STATUS_VARIANT: Record<
  string,
  "warning" | "info" | "successSolid" | "success" | "destructive"
> = {
  PENDING: "warning",
  PREPAID: "info",
  PAID: "successSolid",
  COMPLETED: "success",
  NO_SHOW: "destructive",
  CANCELLED: "destructive",
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const defFrom = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
  const defTo = ymd(now);

  let from = sp.from && DATE_RE.test(sp.from) ? sp.from : defFrom;
  let to = sp.to && DATE_RE.test(sp.to) ? sp.to : defTo;
  if (from > to) [from, to] = [to, from];

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T23:59:59.999Z`);

  const bookings = await prisma.booking.findMany({
    where: { startAt: { gte: fromDate, lte: toDate } },
    select: {
      status: true,
      totalPrice: true,
      prepaymentAmount: true,
      object: { select: { objectType: { select: { id: true, name: true } } } },
    },
  });

  type Agg = { count: number; turnover: number; prepay: number };
  const byStatus = new Map<string, Agg>();
  const byType = new Map<string, Agg & { name: string }>();
  let totalCount = 0; // без отменённых
  let totalTurnover = 0; // только оплаченные/завершённые
  let totalPrepay = 0; // только оплаченные/завершённые

  for (const b of bookings) {
    const price = Number(b.totalPrice);
    const pre = Number(b.prepaymentAmount);

    // «По статусам» — справочная разбивка по всем статусам, как есть.
    const s = byStatus.get(b.status) ?? { count: 0, turnover: 0, prepay: 0 };
    s.count++;
    s.turnover += price;
    s.prepay += pre;
    byStatus.set(b.status, s);

    // «Всего броней» — без отменённых.
    if (b.status !== "CANCELLED") totalCount++;

    // Деньги (оборот, предоплаты) и разбивка по типам — только по броням,
    // реально принёсшим доход: оплаченные, с авансом и завершённые. PENDING
    // (не оплачено), NO_SHOW (не пришёл) и CANCELLED в деньги не идут.
    if (REVENUE_STATUSES.has(b.status)) {
      totalTurnover += price;
      totalPrepay += pre;
      const t = b.object.objectType;
      const e = byType.get(t.id) ?? { name: t.name, count: 0, turnover: 0, prepay: 0 };
      e.count++;
      e.turnover += price;
      e.prepay += pre;
      byType.set(t.id, e);
    }
  }

  const typeRows = Array.from(byType.values()).sort((a, b) => b.turnover - a.turnover);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Отчёты</h1>
        <p className="text-sm text-muted-foreground mt-1">
          За период по дате заезда. «Всего броней» — без отменённых. Оборот и
          предоплаты — только по оплаченным, с авансом и завершённым броням.
        </p>
      </div>

      <ReportFilters from={from} to={to} />

      {/* Сводные карточки */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Всего броней (без отменённых)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Оборот (оплаченные)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gold">{formatRub(totalTurnover)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground font-medium">
              Предоплат внесено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">{formatRub(totalPrepay)}</div>
          </CardContent>
        </Card>
      </div>

      {/* По статусам */}
      <Card>
        <CardHeader>
          <CardTitle>По статусам</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Броней</TableHead>
                <TableHead className="text-right">Оборот</TableHead>
                <TableHead className="text-right">Предоплаты</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STATUS_ORDER.map((st) => {
                const a = byStatus.get(st) ?? { count: 0, turnover: 0, prepay: 0 };
                return (
                  <TableRow key={st}>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[st]}>{STATUS_LABEL[st]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{a.count}</TableCell>
                    <TableCell className="text-right">{formatRub(a.turnover)}</TableCell>
                    <TableCell className="text-right">{formatRub(a.prepay)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* По типам объектов */}
      <Card>
        <CardHeader>
          <CardTitle>По типам объектов</CardTitle>
        </CardHeader>
        <CardContent>
          {typeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных за выбранный период.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тип объекта</TableHead>
                  <TableHead className="text-right">Броней</TableHead>
                  <TableHead className="text-right">Оборот</TableHead>
                  <TableHead className="text-right">Предоплаты</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typeRows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-right">{r.count}</TableCell>
                    <TableCell className="text-right">{formatRub(r.turnover)}</TableCell>
                    <TableCell className="text-right">{formatRub(r.prepay)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
