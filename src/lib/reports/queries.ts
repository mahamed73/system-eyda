import { query } from "@/lib/db";

export interface RevenueReport {
  total: number;
  by_method: { method: string; total: number }[];
  by_day: { date: string; total: number }[];
}

export interface ExpensesReport {
  total: number;
  by_category: { category: string; total: number }[];
  by_day: { date: string; total: number }[];
}

export interface SummaryBucket {
  period_start: string;
  revenue: number;
  expenses: number;
  net: number;
}

export type ReportPeriod = "daily" | "weekly" | "monthly";

/**
 * الإيرادات = مجموع الدفعات (payments) الفعلية المُحصّلة، مش سعر الكشف
 * وحده — عشان يعكس الكاش الحقيقي اللي دخل العيادة، حتى لو فيه زيارات
 * مديونة (متبقي عليها فلوس).
 */
export async function getRevenueReport(
  clinicId: string,
  from: string,
  to: string
): Promise<RevenueReport> {
  const byMethodResult = await query<{ method: string; total: string }>(
    `SELECT COALESCE(p.method, 'other') AS method, SUM(p.amount)::text AS total
     FROM payments p
     JOIN visits v ON v.id = p.visit_id
     WHERE v.clinic_id = $1 AND p.paid_at::date BETWEEN $2 AND $3
     GROUP BY COALESCE(p.method, 'other')
     ORDER BY total DESC`,
    [clinicId, from, to]
  );

  const byDayResult = await query<{ date: string; total: string }>(
    `SELECT p.paid_at::date::text AS date, SUM(p.amount)::text AS total
     FROM payments p
     JOIN visits v ON v.id = p.visit_id
     WHERE v.clinic_id = $1 AND p.paid_at::date BETWEEN $2 AND $3
     GROUP BY p.paid_at::date
     ORDER BY date ASC`,
    [clinicId, from, to]
  );

  const total = byMethodResult.rows.reduce((sum, r) => sum + Number(r.total), 0);

  return {
    total,
    by_method: byMethodResult.rows.map((r) => ({ method: r.method, total: Number(r.total) })),
    by_day: byDayResult.rows.map((r) => ({ date: r.date, total: Number(r.total) })),
  };
}

export async function getExpensesReport(
  clinicId: string,
  from: string,
  to: string
): Promise<ExpensesReport> {
  const byCategoryResult = await query<{ category: string; total: string }>(
    `SELECT COALESCE(category, 'أخرى') AS category, SUM(amount)::text AS total
     FROM expenses
     WHERE clinic_id = $1 AND expense_date BETWEEN $2 AND $3
     GROUP BY COALESCE(category, 'أخرى')
     ORDER BY total DESC`,
    [clinicId, from, to]
  );

  const byDayResult = await query<{ date: string; total: string }>(
    `SELECT expense_date::text AS date, SUM(amount)::text AS total
     FROM expenses
     WHERE clinic_id = $1 AND expense_date BETWEEN $2 AND $3
     GROUP BY expense_date
     ORDER BY date ASC`,
    [clinicId, from, to]
  );

  const total = byCategoryResult.rows.reduce((sum, r) => sum + Number(r.total), 0);

  return {
    total,
    by_category: byCategoryResult.rows.map((r) => ({ category: r.category, total: Number(r.total) })),
    by_day: byDayResult.rows.map((r) => ({ date: r.date, total: Number(r.total) })),
  };
}

/**
 * تقرير مالي كامل لفترة معيّنة — بيعتمد على نفس الاستعلامات الموجودة،
 * وبيجمّعها في كيان واحد جاهز للتصدير (Excel) أو الطباعة (PDF).
 */
export interface FullFinancialReport {
  from: string;
  to: string;
  revenue: RevenueReport;
  expenses: ExpensesReport;
  daily: SummaryBucket[];
  totals: SummaryBucket;
}

export async function getFullFinancialReport(
  clinicId: string,
  from: string,
  to: string
): Promise<FullFinancialReport> {
  const [revenue, expenses, summary] = await Promise.all([
    getRevenueReport(clinicId, from, to),
    getExpensesReport(clinicId, from, to),
    getSummaryReport({ clinicId, period: "daily", from, to }),
  ]);

  return {
    from,
    to,
    revenue,
    expenses,
    daily: summary.buckets,
    totals: summary.totals,
  };
}

function defaultRangeForPeriod(period: ReportPeriod) {
  const to = new Date();
  const from = new Date();
  if (period === "daily") from.setDate(from.getDate() - 30);
  else if (period === "weekly") from.setDate(from.getDate() - 7 * 12);
  else from.setMonth(from.getMonth() - 12);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

/**
 * ملخّص إيرادات/مصروفات/صافي الربح مجمّع حسب فترة (يومي/أسبوعي/شهري).
 */
export async function getSummaryReport(params: {
  clinicId: string;
  period: ReportPeriod;
  from?: string;
  to?: string;
}): Promise<{ buckets: SummaryBucket[]; totals: SummaryBucket }> {
  const { clinicId, period } = params;
  const truncUnit = period === "daily" ? "day" : period === "weekly" ? "week" : "month";
  const defaults = defaultRangeForPeriod(period);
  const from = params.from ?? defaults.from;
  const to = params.to ?? defaults.to;

  const revenueResult = await query<{ bucket: string; total: string }>(
    `SELECT date_trunc('${truncUnit}', p.paid_at)::date::text AS bucket, SUM(p.amount)::text AS total
     FROM payments p
     JOIN visits v ON v.id = p.visit_id
     WHERE v.clinic_id = $1 AND p.paid_at::date BETWEEN $2 AND $3
     GROUP BY bucket`,
    [clinicId, from, to]
  );

  const expensesResult = await query<{ bucket: string; total: string }>(
    `SELECT date_trunc('${truncUnit}', expense_date)::date::text AS bucket, SUM(amount)::text AS total
     FROM expenses
     WHERE clinic_id = $1 AND expense_date BETWEEN $2 AND $3
     GROUP BY bucket`,
    [clinicId, from, to]
  );

  const map = new Map<string, { revenue: number; expenses: number }>();
  for (const r of revenueResult.rows) {
    map.set(r.bucket, { revenue: Number(r.total), expenses: 0 });
  }
  for (const e of expensesResult.rows) {
    const existing = map.get(e.bucket) ?? { revenue: 0, expenses: 0 };
    existing.expenses = Number(e.total);
    map.set(e.bucket, existing);
  }

  const buckets: SummaryBucket[] = Array.from(map.entries())
    .map(([period_start, v]) => ({
      period_start,
      revenue: v.revenue,
      expenses: v.expenses,
      net: v.revenue - v.expenses,
    }))
    .sort((a, b) => a.period_start.localeCompare(b.period_start));

  const totals = buckets.reduce(
    (acc, b) => ({
      period_start: "total",
      revenue: acc.revenue + b.revenue,
      expenses: acc.expenses + b.expenses,
      net: acc.net + b.net,
    }),
    { period_start: "total", revenue: 0, expenses: 0, net: 0 }
  );

  return { buckets, totals };
}
