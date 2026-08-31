"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Expense } from "@/lib/expenses/types";

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function ExpensesPage() {
  const [from, setFrom] = useState(daysAgoStr(30));
  const [to, setTo] = useState(todayStr());
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from, to });
        if (category) params.set("category", category);
        const res = await fetch(`/api/expenses?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "تعذّر تحميل المصروفات");
        if (!cancelled) {
          setExpenses(json.data ?? []);
          setTotal(json.total ?? 0);
          setCategories(json.categories ?? []);
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
  }, [from, to, category]);

  async function handleDelete(id: string) {
    if (!confirm("متأكد إنك عايز تحذف المصروف ده؟")) return;
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (res.ok) {
      setExpenses((prev) => {
        const next = prev.filter((e) => e.id !== id);
        return next;
      });
      setTotal((prev) => {
        const removed = expenses.find((e) => e.id === id);
        return removed ? prev - Number(removed.amount) : prev;
      });
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-slate-800 text-lg">المصروفات</h1>
        <Link
          href="/expenses/new"
          className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          + تسجيل مصروف جديد
        </Link>
      </div>

        <div className="flex flex-wrap items-end gap-3 mb-6 bg-white border border-slate-200 rounded-xl p-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">من تاريخ</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">التصنيف</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">كل التصنيفات</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="mr-auto text-sm text-slate-600">
            إجمالي المصروفات في الفترة دي: <strong className="text-slate-800">{total} ج.م</strong>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">الوصف</th>
                <th className="px-4 py-3 font-medium">التصنيف</th>
                <th className="px-4 py-3 font-medium">المبلغ</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    جاري التحميل...
                  </td>
                </tr>
              )}
              {!loading && expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    مفيش مصروفات مسجلة في الفترة دي.
                  </td>
                </tr>
              )}
              {!loading &&
                expenses.map((e) => (
                  <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{e.description}</td>
                    <td className="px-4 py-3 text-slate-500">{e.category || "—"}</td>
                    <td className="px-4 py-3 text-slate-600">{e.amount} ج.م</td>
                    <td className="px-4 py-3 text-slate-500">{e.expense_date}</td>
                    <td className="px-4 py-3 text-left">
                      <button onClick={() => handleDelete(e.id)} className="text-xs text-red-500 hover:underline">
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
