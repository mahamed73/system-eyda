"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const categories = ["إيجار", "فواتير", "مستلزمات", "صيانة", "رواتب", "أخرى"];

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function NewExpensePage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayStr());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          category,
          amount: Number(amount),
          expense_date: expenseDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "تعذّر تسجيل المصروف");
      router.push("/expenses");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <Link href="/expenses" className="text-sm text-sky-600 hover:underline">
        ← رجوع للمصروفات
      </Link>
      <h1 className="font-bold text-slate-800 text-lg mt-1 mb-6">تسجيل مصروف جديد</h1>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-slate-200 rounded-xl p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الوصف *</label>
            <input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: إيجار شهر أغسطس"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">التصنيف</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المبلغ (ج.م) *</label>
              <input
                required
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ</label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
          >
            {isSubmitting ? "جاري الحفظ..." : "تسجيل المصروف"}
          </button>
        </form>
    </div>
  );
}
