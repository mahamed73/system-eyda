"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ExpensesReport, RevenueReport, SummaryBucket } from "@/lib/reports/queries";

type Period = "daily" | "weekly" | "monthly";

const periodLabels: Record<Period, string> = {
  daily: "يومي",
  weekly: "أسبوعي",
  monthly: "شهري",
};

const methodLabels: Record<string, string> = {
  cash: "كاش",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
  other: "أخرى",
};

function formatMoney(n: number) {
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

function formatBucketLabel(dateStr: string, period: Period) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (period === "monthly") return d.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
  if (period === "weekly") return `أسبوع ${d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}`;
  return d.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [summary, setSummary] = useState<{ buckets: SummaryBucket[]; totals: SummaryBucket } | null>(null);
  const [revenue, setRevenue] = useState<RevenueReport | null>(null);
  const [expensesReport, setExpensesReport] = useState<ExpensesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState(defaultRange());

  function openPrint() {
    window.open(`/reports/print?from=${range.from}&to=${range.to}`, "_blank");
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [summaryRes, revenueRes, expensesRes] = await Promise.all([
          fetch(`/api/reports/summary?period=${period}`),
          fetch(`/api/reports/revenue`),
          fetch(`/api/reports/expenses`),
        ]);
        const summaryJson = await summaryRes.json();
        const revenueJson = await revenueRes.json();
        const expensesJson = await expensesRes.json();

        if (!summaryRes.ok) throw new Error(summaryJson?.error ?? "تعذّر تحميل التقرير");

        if (!cancelled) {
          setSummary(summaryJson.data);
          setRevenue(revenueJson.data);
          setExpensesReport(expensesJson.data);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const maxBucketValue = summary
    ? Math.max(1, ...summary.buckets.map((b) => Math.max(b.revenue, b.expenses)))
    : 1;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-bold text-slate-800 text-lg">التقارير المالية</h1>
        <Link
          href="/reports/doctors"
          className="text-sm bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-50"
        >
          👨‍⚕️ تقرير أداء الأطباء
        </Link>
      </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4 text-sm">تصدير التقرير</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">من تاريخ</label>
              <input
                type="date"
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">إلى تاريخ</label>
              <input
                type="date"
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                className="text-sm border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div className="flex gap-2">
              <a
                href={`/api/reports/export?format=xlsx&from=${range.from}&to=${range.to}`}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors inline-block"
              >
                ⬇️ تحميل Excel
              </a>
              <button
                onClick={openPrint}
                className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
              >
                🖨️ حفظ PDF / طباعة
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {(Object.keys(periodLabels) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`text-sm rounded-lg px-4 py-2 border transition-colors ${
                period === p
                  ? "bg-sky-600 text-white border-sky-600"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {loading && <p className="text-slate-400 text-sm">جاري التحميل...</p>}

        {!loading && summary && (
          <>
            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm text-slate-500 mb-1">إجمالي الإيرادات (آخر فترة معروضة)</p>
                <p className="text-2xl font-bold text-emerald-700">{formatMoney(summary.totals.revenue)} ج.م</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm text-slate-500 mb-1">إجمالي المصروفات</p>
                <p className="text-2xl font-bold text-red-600">{formatMoney(summary.totals.expenses)} ج.م</p>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <p className="text-sm text-slate-500 mb-1">صافي الربح</p>
                <p
                  className={`text-2xl font-bold ${summary.totals.net >= 0 ? "text-sky-700" : "text-red-600"}`}
                >
                  {formatMoney(summary.totals.net)} ج.م
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
              <h2 className="font-semibold text-slate-800 mb-4">
                الإيرادات مقابل المصروفات ({periodLabels[period]})
              </h2>
              {summary.buckets.length === 0 && (
                <p className="text-sm text-slate-400">مفيش بيانات كافية للفترة دي لسه.</p>
              )}
              <div className="space-y-3">
                {summary.buckets.map((b) => (
                  <div key={b.period_start}>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>{formatBucketLabel(b.period_start, period)}</span>
                      <span>
                        إيراد {formatMoney(b.revenue)} — مصروف {formatMoney(b.expenses)}
                      </span>
                    </div>
                    <div className="flex gap-1 h-2.5 rounded-full overflow-hidden bg-slate-100">
                      <div
                        className="bg-emerald-500"
                        style={{ width: `${(b.revenue / maxBucketValue) * 50}%` }}
                      />
                      <div
                        className="bg-red-400"
                        style={{ width: `${(b.expenses / maxBucketValue) * 50}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-semibold text-slate-800 mb-3">الإيرادات حسب طريقة الدفع (آخر 30 يوم)</h2>
                {(!revenue || revenue.by_method.length === 0) && (
                  <p className="text-sm text-slate-400">مفيش مدفوعات مسجلة في آخر 30 يوم.</p>
                )}
                <ul className="space-y-2 text-sm">
                  {revenue?.by_method.map((m) => (
                    <li key={m.method} className="flex justify-between border-b border-slate-50 pb-1">
                      <span>{methodLabels[m.method] ?? m.method}</span>
                      <span className="font-medium text-slate-700">{formatMoney(m.total)} ج.م</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6">
                <h2 className="font-semibold text-slate-800 mb-3">المصروفات حسب التصنيف (آخر 30 يوم)</h2>
                {(!expensesReport || expensesReport.by_category.length === 0) && (
                  <p className="text-sm text-slate-400">مفيش مصروفات مسجلة في آخر 30 يوم.</p>
                )}
                <ul className="space-y-2 text-sm">
                  {expensesReport?.by_category.map((c) => (
                    <li key={c.category} className="flex justify-between border-b border-slate-50 pb-1">
                      <span>{c.category}</span>
                      <span className="font-medium text-slate-700">{formatMoney(c.total)} ج.م</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-4 mt-6 text-sm">
              <Link href="/expenses" className="text-sky-600 hover:underline">
                إدارة المصروفات ←
              </Link>
            </div>
          </>
        )}
    </div>
  );
}
