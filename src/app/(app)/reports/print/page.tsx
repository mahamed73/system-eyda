"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { FullFinancialReport } from "@/lib/reports/queries";

const methodLabels: Record<string, string> = {
  cash: "كاش",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
  other: "أخرى",
};

function formatMoney(n: number) {
  return n.toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}

function PrintReportView() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [report, setReport] = useState<FullFinancialReport | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const res = await fetch(`/api/reports/financial?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "تعذّر تحميل التقرير");
        if (!cancelled) {
          setReport(json.data);
          setClinicName(json.clinicName ?? "");
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
  }, [from, to]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <h1 className="font-bold text-slate-800 text-lg">معاينة التقرير المالي</h1>
        <button
          onClick={() => window.print()}
          className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg px-5 py-2.5 transition-colors"
        >
          🖨️ حفظ PDF / طباعة
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4 print:hidden">
          {error}
        </p>
      )}

      {loading && <p className="text-slate-400 text-sm print:hidden">جاري التحميل...</p>}

      {!loading && report && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 print:border-0 print:p-0 print:rounded-none">
          {/* رأس التقرير */}
          <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
            <h2 className="text-xl font-bold text-slate-900">{clinicName}</h2>
            <p className="text-sm text-slate-600 mt-1">التقرير المالي</p>
            <p className="text-sm text-slate-500 mt-1">
              الفترة من {report.from} إلى {report.to}
            </p>
          </div>

          {/* الملخص */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="text-center border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">إجمالي الإيرادات</p>
              <p className="text-lg font-bold text-emerald-700">{formatMoney(report.totals.revenue)} ج.م</p>
            </div>
            <div className="text-center border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">إجمالي المصروفات</p>
              <p className="text-lg font-bold text-red-600">{formatMoney(report.totals.expenses)} ج.م</p>
            </div>
            <div className="text-center border border-slate-200 rounded-lg p-4">
              <p className="text-xs text-slate-500 mb-1">صافي الربح</p>
              <p className={`text-lg font-bold ${report.totals.net >= 0 ? "text-sky-700" : "text-red-600"}`}>
                {formatMoney(report.totals.net)} ج.م
              </p>
            </div>
          </div>

          {/* الإيرادات حسب طريقة الدفع */}
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">الإيرادات حسب طريقة الدفع</h3>
          <table className="w-full text-sm mb-8 border-collapse">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="text-right py-2 px-2 font-semibold text-slate-700">طريقة الدفع</th>
                <th className="text-left py-2 px-2 font-semibold text-slate-700">الإجمالي (ج.م)</th>
              </tr>
            </thead>
            <tbody>
              {report.revenue.by_method.map((m) => (
                <tr key={m.method} className="border-b border-slate-100">
                  <td className="py-2 px-2">{methodLabels[m.method] ?? m.method}</td>
                  <td className="py-2 px-2">{formatMoney(m.total)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 px-2">الإجمالي</td>
                <td className="py-2 px-2">{formatMoney(report.revenue.total)}</td>
              </tr>
            </tbody>
          </table>

          {/* المصروفات حسب التصنيف */}
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">المصروفات حسب التصنيف</h3>
          <table className="w-full text-sm mb-8 border-collapse">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="text-right py-2 px-2 font-semibold text-slate-700">التصنيف</th>
                <th className="text-left py-2 px-2 font-semibold text-slate-700">الإجمالي (ج.م)</th>
              </tr>
            </thead>
            <tbody>
              {report.expenses.by_category.map((c) => (
                <tr key={c.category} className="border-b border-slate-100">
                  <td className="py-2 px-2">{c.category}</td>
                  <td className="py-2 px-2">{formatMoney(c.total)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 px-2">الإجمالي</td>
                <td className="py-2 px-2">{formatMoney(report.expenses.total)}</td>
              </tr>
            </tbody>
          </table>

          {/* التفاصيل اليومية */}
          <h3 className="font-semibold text-slate-800 mb-3 text-sm">التفاصيل اليومية</h3>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="text-right py-2 px-2 font-semibold text-slate-700">اليوم</th>
                <th className="text-left py-2 px-2 font-semibold text-slate-700">الإيرادات</th>
                <th className="text-left py-2 px-2 font-semibold text-slate-700">المصروفات</th>
                <th className="text-left py-2 px-2 font-semibold text-slate-700">الصافي</th>
              </tr>
            </thead>
            <tbody>
              {report.daily.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 px-2 text-slate-400 text-center">
                    مفيش بيانات في الفترة دي.
                  </td>
                </tr>
              )}
              {report.daily.map((b) => (
                <tr key={b.period_start} className="border-b border-slate-100">
                  <td className="py-2 px-2">{b.period_start}</td>
                  <td className="py-2 px-2">{formatMoney(b.revenue)}</td>
                  <td className="py-2 px-2">{formatMoney(b.expenses)}</td>
                  <td className="py-2 px-2">{formatMoney(b.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-xs text-slate-400 mt-8 text-center border-t border-slate-200 pt-4">
            تم إنشاء هذا التقرير تلقائيًا من نظام إدارة العيادات — {new Date().toLocaleDateString("ar-EG")}
          </p>
        </div>
      )}
    </div>
  );
}

export default function PrintReportPage() {
  return (
    <Suspense fallback={null}>
      <PrintReportView />
    </Suspense>
  );
}
