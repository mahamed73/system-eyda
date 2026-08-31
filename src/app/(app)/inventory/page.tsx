"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { InventoryItemWithStatus } from "@/lib/inventory/types";

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItemWithStatus[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (lowStockOnly) params.set("low_stock", "1");
        const res = await fetch(`/api/inventory?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "تعذّر تحميل المخزون");
        if (!cancelled) setItems(json.data ?? []);
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
  }, [debouncedSearch, lowStockOnly]);

  async function quickMove(id: string, changeQty: number) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/inventory/${id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ change_qty: changeQty, reason: changeQty > 0 ? "إضافة سريعة" : "سحب سريع" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "تعذّر تسجيل الحركة");
      setItems((prev) => prev.map((it) => (it.id === id ? json.data : it)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setBusyId(null);
    }
  }

  const lowStockCount = items.filter((i) => i.is_low_stock).length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-slate-800 text-lg">المخزون</h1>
        <Link
          href="/inventory/new"
          className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          + إضافة صنف جديد
        </Link>
      </div>

        {lowStockCount > 0 && (
          <p className="text-sm bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 mb-4">
            ⚠️ فيه {lowStockCount} صنف وصل للحد الأدنى أو أقل ومحتاج إعادة تموين.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الصنف..."
            className="w-full sm:w-72 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            الأصناف المنخفضة فقط
          </label>
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
                <th className="px-4 py-3 font-medium">الصنف</th>
                <th className="px-4 py-3 font-medium">الكمية</th>
                <th className="px-4 py-3 font-medium">الحد الأدنى</th>
                <th className="px-4 py-3 font-medium">سعر الوحدة</th>
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
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    مفيش أصناف مسجلة في المخزون لسه.
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      <Link href={`/inventory/${item.id}`} className="hover:underline">
                        {item.name}
                      </Link>
                      {item.is_low_stock && (
                        <span className="ml-2 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5">
                          تحت الحد الأدنى
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => quickMove(item.id, -1)}
                          disabled={busyId === item.id || item.quantity <= 0}
                          className="w-6 h-6 rounded border border-slate-300 text-slate-600 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="min-w-[48px] text-center">
                          {item.quantity} {item.unit}
                        </span>
                        <button
                          onClick={() => quickMove(item.id, 1)}
                          disabled={busyId === item.id}
                          className="w-6 h-6 rounded border border-slate-300 text-slate-600 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.min_threshold} {item.unit}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {item.unit_price ? `${item.unit_price} ج.م` : "—"}
                    </td>
                    <td className="px-4 py-3 text-left">
                      <Link href={`/inventory/${item.id}`} className="text-sky-600 hover:underline">
                        تفاصيل
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
    </div>
  );
}
