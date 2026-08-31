"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { showToast } from "@/components/toast-provider";

interface FollowUp {
  visit_id: string;
  follow_up_date: string;
  diagnosis: string | null;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  days_offset: string | null;
}

const TABS = [
  { key: "due", label: "متأخرة", cls: "text-red-600 border-red-500" },
  { key: "today", label: "النهاردة", cls: "text-amber-600 border-amber-500" },
  { key: "upcoming", label: "الأسبوع الجاي", cls: "text-sky-600 border-sky-500" },
] as const;

export default function FollowUpsPage() {
  const [tab, setTab] = useState<string>("due");
  const [items, setItems] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/follow-ups?filter=${tab}`, { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setItems(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function complete(item: FollowUp) {
    const res = await fetch("/api/follow-ups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visit_id: item.visit_id, completed: true }),
    });
    if (res.ok) {
      showToast("✅ تم تسجيل المتابعة", "success");
      load();
    } else {
      showToast("فشل التحديث", "error");
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">📞 متابعة المرضى</h1>
      <p className="text-sm text-slate-500 mb-6">
        المرضى اللي الطبيب حدّدلهم تاريخ متابعة — اتصل بيهم وسجّل النتيجة.
      </p>

      {/* تبويبات */}
      <div className="flex gap-2 mb-5 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t.key ? t.cls : "text-slate-400 border-transparent hover:text-slate-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-slate-400 text-sm py-8 text-center">جاري التحميل...</p>}

      {!loading && items.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
          <p className="text-4xl mb-2">🎉</p>
          <p className="text-green-700 font-semibold">مفيش متابعات معلّقة — كله تمام</p>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((f) => {
          const days = f.days_offset != null ? Number(f.days_offset) : null;
          return (
            <li key={f.visit_id} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/patients/${f.patient_id}`}
                      className="font-bold text-slate-800 hover:text-sky-600"
                    >
                      {f.patient_name}
                    </Link>
                    {days !== null && days < 0 && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                        متأخرة {Math.abs(days)} يوم
                      </span>
                    )}
                    {days === 0 && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                        النهاردة
                      </span>
                    )}
                    {days !== null && days > 0 && (
                      <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                        بعد {days} يوم
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    تاريخ المتابعة: {f.follow_up_date} — {f.doctor_name}
                  </p>
                  {f.diagnosis && (
                    <p className="text-sm text-slate-600 mt-1.5 line-clamp-1">
                      🩺 {f.diagnosis}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={`https://wa.me/2${f.patient_phone.replace(/^0/, "")}?text=${encodeURIComponent(
                      `مرحبًا ${f.patient_name}، معاك عيادة ${f.doctor_name} بخصوص ميعاد المتابعة بتاعك.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700"
                  >
                    واتساب
                  </a>
                  <Link
                    href={`/visits/new?patientId=${f.patient_id}`}
                    className="text-sm bg-sky-600 text-white px-3 py-2 rounded-lg hover:bg-sky-700"
                  >
                    حجز متابعة
                  </Link>
                  <button
                    onClick={() => complete(f)}
                    className="text-sm border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50"
                  >
                    ✅ تمت
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
