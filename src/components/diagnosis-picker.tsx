"use client";

import { useEffect, useRef, useState } from "react";

interface DiagnosisItem {
  id: string;
  title: string;
  diagnosis: string | null;
  prescription: string | null;
  usage_count: number;
}

/**
 * مكتبة التشخيصات الجاهزة — قائمة منسدلة ببحث سريع.
 * لما الطبيب يختار تشخيص: بتتملى حقول التشخيص/الروشتة، وبيزداد عدّاد
 * الاستخدام، وممكن كمان يضيف تشخيص جديد للمكتبة من نفس المكان.
 */
export default function DiagnosisPicker({
  onPick,
}: {
  onPick: (d: { diagnosis: string; prescription: string }) => void;
}) {
  const [items, setItems] = useState<DiagnosisItem[]>([]);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDiagnosis, setNewDiagnosis] = useState("");
  const [newPrescription, setNewPrescription] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  async function load(search = "") {
    const res = await fetch(`/api/diagnoses${search ? `?q=${encodeURIComponent(search)}` : ""}`);
    if (res.ok) {
      const json = await res.json();
      setItems(json.data ?? []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function pick(item: DiagnosisItem) {
    onPick({
      diagnosis: item.diagnosis ?? "",
      prescription: item.prescription ?? "",
    });
    // عدّاد الاستخدام (fire-and-forget)
    fetch(`/api/diagnoses/${item.id}/use`, { method: "POST" }).catch(() => {});
    setOpen(false);
    setQ("");
  }

  async function addNew(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/diagnoses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        diagnosis: newDiagnosis,
        prescription: newPrescription,
      }),
    });
    if (res.ok) {
      onPick({ diagnosis: newDiagnosis, prescription: newPrescription });
      setShowAdd(false);
      setNewTitle("");
      setNewDiagnosis("");
      setNewPrescription("");
      setOpen(false);
      load();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm bg-sky-50 text-sky-700 border border-sky-200 px-3 py-2 rounded-lg hover:bg-sky-100 w-full text-right"
      >
        📚 مكتبة التشخيصات — اختر تشخيص جاهز
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث في التشخيصات..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
            />
          </div>

          <ul className="max-h-56 overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => pick(item)}
                  className="w-full text-right px-3 py-2.5 hover:bg-sky-50 border-b border-slate-50"
                >
                  <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                  {item.diagnosis && (
                    <p className="text-xs text-slate-400 truncate">{item.diagnosis}</p>
                  )}
                </button>
              </li>
            ))}
            {items.length === 0 && !showAdd && (
              <li className="px-3 py-4 text-center text-sm text-slate-400">
                مفيش نتائج — تقدر تضيف تشخيص جديد
              </li>
            )}
          </ul>

          <div className="border-t border-slate-100">
            {!showAdd ? (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="w-full text-sm text-sky-600 font-semibold py-2.5 hover:bg-sky-50"
              >
                + إضافة تشخيص جديد للمكتبة
              </button>
            ) : (
              <form onSubmit={addNew} className="p-3 space-y-2">
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="عنوان مختصر (مثال: التهاب لثة)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
                  required
                />
                <textarea
                  value={newDiagnosis}
                  onChange={(e) => setNewDiagnosis(e.target.value)}
                  placeholder="نص التشخيص"
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
                />
                <textarea
                  value={newPrescription}
                  onChange={(e) => setNewPrescription(e.target.value)}
                  placeholder="الروشتة (اختياري)"
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-sky-500"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-sky-600 text-white text-sm font-semibold py-2 rounded-lg hover:bg-sky-700"
                  >
                    حفظ واستخدام
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="px-3 text-sm text-slate-500"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
