"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { InventoryItemWithStatus, InventoryMovement } from "@/lib/inventory/types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

export default function InventoryItemPage() {
  const params = useParams<{ id: string }>();
  const [item, setItem] = useState<InventoryItemWithStatus | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [minThreshold, setMinThreshold] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [moveQty, setMoveQty] = useState("");
  const [moveReason, setMoveReason] = useState("");
  const [moveError, setMoveError] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [itemRes, movementsRes] = await Promise.all([
          fetch(`/api/inventory/${params.id}`),
          fetch(`/api/inventory/${params.id}/movements`),
        ]);
        const itemJson = await itemRes.json();
        if (!itemRes.ok) throw new Error(itemJson?.error ?? "تعذّر تحميل بيانات الصنف");
        if (cancelled) return;
        setItem(itemJson.data);
        setName(itemJson.data.name);
        setUnit(itemJson.data.unit);
        setMinThreshold(String(itemJson.data.min_threshold));
        setUnitPrice(itemJson.data.unit_price ? String(itemJson.data.unit_price) : "");

        const movementsJson = await movementsRes.json();
        if (!cancelled && movementsRes.ok) setMovements(movementsJson.data ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadAll();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setIsSaving(true);
    setSavedMessage(null);
    try {
      const res = await fetch(`/api/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          unit,
          min_threshold: Number(minThreshold),
          unit_price: unitPrice ? Number(unitPrice) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "تعذّر حفظ التعديلات");
      setItem(json.data);
      setSavedMessage("تم الحفظ ✅");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMovement(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setMoveError(null);
    const qty = Number(moveQty);
    if (!qty) {
      setMoveError("أدخل كمية مختلفة عن صفر (سالبة للسحب، موجبة للإضافة)");
      return;
    }
    setIsMoving(true);
    try {
      const res = await fetch(`/api/inventory/${item.id}/movements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ change_qty: qty, reason: moveReason || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "تعذّر تسجيل الحركة");
      setItem(json.data);
      setMoveQty("");
      setMoveReason("");
      const movementsRes = await fetch(`/api/inventory/${item.id}/movements`);
      const movementsJson = await movementsRes.json();
      if (movementsRes.ok) setMovements(movementsJson.data ?? []);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setIsMoving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <Link href="/inventory" className="text-sm text-sky-600 hover:underline">
        ← رجوع للمخزون
      </Link>
      <h1 className="font-bold text-slate-800 text-lg mt-1">
        {item ? `صنف: ${item.name}` : "تفاصيل الصنف"}
      </h1>

        {loading && <p className="text-slate-400 text-sm">جاري التحميل...</p>}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!loading && item && (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">الكمية الحالية</p>
                <p className="text-2xl font-bold text-slate-800">
                  {item.quantity} <span className="text-sm font-normal text-slate-500">{item.unit}</span>
                </p>
              </div>
              {item.is_low_stock && (
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-3 py-1">
                  ⚠️ تحت الحد الأدنى ({item.min_threshold})
                </span>
              )}
            </div>

            <form onSubmit={handleMovement} className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <h2 className="font-semibold text-slate-800">تسجيل حركة (إضافة / سحب)</h2>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">
                    الكمية (موجب = إضافة، سالب = سحب)
                  </label>
                  <input
                    type="number"
                    value={moveQty}
                    onChange={(e) => setMoveQty(e.target.value)}
                    placeholder="مثال: -2 أو 10"
                    className="rounded-lg border border-slate-300 px-3 py-2 w-40 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs text-slate-500 mb-1">السبب (اختياري)</label>
                  <input
                    value={moveReason}
                    onChange={(e) => setMoveReason(e.target.value)}
                    placeholder="مثال: استخدام في كشف، توريد جديد..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isMoving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                >
                  {isMoving ? "جاري التسجيل..." : "تسجيل الحركة"}
                </button>
              </div>
              {moveError && <p className="text-sm text-red-600">{moveError}</p>}
            </form>

            <form onSubmit={handleSave} className="space-y-4 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-semibold text-slate-800">بيانات الصنف</h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الاسم</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">الوحدة</label>
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
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

              {savedMessage && <p className="text-sm text-emerald-700">{savedMessage}</p>}

              <button
                type="submit"
                disabled={isSaving}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
              >
                {isSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-semibold text-slate-800 mb-3">سجل الحركات</h2>
              {movements.length === 0 && (
                <p className="text-sm text-slate-400">مفيش حركات مسجلة لسه على الصنف ده.</p>
              )}
              <ul className="space-y-1 text-sm">
                {movements.map((m) => (
                  <li key={m.id} className="flex justify-between border-b border-slate-50 pb-1">
                    <span className={m.change_qty > 0 ? "text-emerald-700" : "text-red-600"}>
                      {m.change_qty > 0 ? `+${m.change_qty}` : m.change_qty}
                    </span>
                    <span className="text-slate-500">{m.reason || "—"}</span>
                    <span className="text-xs text-slate-400">{formatDate(m.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
    </div>
  );
}
