"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NewInventoryItemPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("قطعة");
  const [quantity, setQuantity] = useState("0");
  const [minThreshold, setMinThreshold] = useState("5");
  const [unitPrice, setUnitPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          unit,
          quantity: Number(quantity),
          min_threshold: Number(minThreshold),
          unit_price: unitPrice ? Number(unitPrice) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "تعذّر إضافة الصنف");
      router.push(`/inventory/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <Link href="/inventory" className="text-sm text-sky-600 hover:underline">
        ← رجوع للمخزون
      </Link>
      <h1 className="font-bold text-slate-800 text-lg mt-1 mb-6">إضافة صنف مخزون جديد</h1>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-slate-200 rounded-xl p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">اسم الصنف *</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: قفازات طبية"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الوحدة</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الكمية الابتدائية</label>
              <input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">الحد الأدنى للتنبيه</label>
              <input
                type="number"
                min={0}
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">سعر الوحدة (ج.م)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
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
            {isSubmitting ? "جاري الحفظ..." : "إضافة الصنف"}
          </button>
        </form>
    </div>
  );
}
