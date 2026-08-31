"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/toast-provider";

interface VisitType {
  label: string;
  price: number;
}

interface Settings {
  name: string;
  online_booking_enabled: boolean;
  booking_slug: string | null;
  booking_slot_minutes: number;
  work_start_time: string;
  work_end_time: string;
  working_days: number[];
  booking_visit_types: VisitType[];
}

const DAY_LABELS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function BookingSettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/clinic/settings")
      .then((r) => r.json())
      .then((json) => json.data && setS(json.data));
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    try {
      const res = await fetch("/api/clinic/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "فشل الحفظ", "error");
      } else {
        showToast("✅ تم حفظ الإعدادات", "success");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!s) return <p className="p-8 text-slate-400 text-sm">جاري التحميل...</p>;

  const bookingUrl = s.booking_slug
    ? typeof window !== "undefined"
      ? `${window.location.origin}/b/${s.booking_slug}`
      : `/b/${s.booking_slug}`
    : null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">🌐 إعدادات الحجز الأونلاين</h1>
        <p className="text-sm text-slate-500 mt-1">صفحة حجز عامة لعيادتك متاحة 24 ساعة للمرضى.</p>
      </div>

      {/* التفعيل */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5">
        <label className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-800">تفعيل الحجز الأونلاين</p>
            <p className="text-xs text-slate-400 mt-0.5">لما يتفعّل، المرضى يقدروا يحجزوا من الرابط العام.</p>
          </div>
          <input
            type="checkbox"
            checked={s.online_booking_enabled}
            onChange={(e) => setS({ ...s, online_booking_enabled: e.target.checked })}
            className="w-5 h-5 accent-sky-600"
          />
        </label>
      </section>

      {/* الرابط */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <label className="block text-sm font-semibold text-slate-700">رابط صفحة الحجز</label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">/b/</span>
          <input
            value={s.booking_slug ?? ""}
            onChange={(e) => setS({ ...s, booking_slug: e.target.value })}
            placeholder="dr-ahmad-clinic"
            dir="ltr"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-left outline-none focus:border-sky-500"
          />
        </div>
        {bookingUrl && (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-sm text-sky-600 hover:underline break-all"
            dir="ltr"
          >
            {bookingUrl}
          </a>
        )}
        <p className="text-xs text-slate-400">
          حروف إنجليزية صغيرة وأرقام وشرطة بس — مثال: dr-khaled-nour
        </p>
      </section>

      {/* ساعات العمل */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <p className="text-sm font-semibold text-slate-700">⏰ ساعات العمل</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">من</label>
            <input
              type="time"
              value={s.work_start_time}
              onChange={(e) => setS({ ...s, work_start_time: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">إلى</label>
            <input
              type="time"
              value={s.work_end_time}
              onChange={(e) => setS({ ...s, work_end_time: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {DAY_LABELS.map((label, idx) => {
            const on = s.working_days.includes(idx);
            return (
              <button
                key={idx}
                type="button"
                onClick={() =>
                  setS({
                    ...s,
                    working_days: on
                      ? s.working_days.filter((d) => d !== idx)
                      : [...s.working_days, idx],
                  })
                }
                className={`px-3 py-1.5 rounded-lg border text-sm ${
                  on ? "bg-sky-600 text-white border-sky-600" : "bg-white text-slate-500 border-slate-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">مدة الموعد (دقائق)</label>
          <select
            value={s.booking_slot_minutes}
            onChange={(e) => setS({ ...s, booking_slot_minutes: Number(e.target.value) })}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            {[10, 15, 20, 30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} دقيقة
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* أنواع الزيارة */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <p className="text-sm font-semibold text-slate-700">🩺 أنواع الزيارة والأسعار</p>
        {s.booking_visit_types.map((vt, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              value={vt.label}
              onChange={(e) =>
                setS({
                  ...s,
                  booking_visit_types: s.booking_visit_types.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x
                  ),
                })
              }
              placeholder="كشف / متابعة..."
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="number"
              min={0}
              value={vt.price}
              onChange={(e) =>
                setS({
                  ...s,
                  booking_visit_types: s.booking_visit_types.map((x, j) =>
                    j === i ? { ...x, price: Number(e.target.value) } : x
                  ),
                })
              }
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <span className="text-xs text-slate-400">ج.م</span>
            {s.booking_visit_types.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setS({
                    ...s,
                    booking_visit_types: s.booking_visit_types.filter((_, j) => j !== i),
                  })
                }
                className="text-red-500 text-sm px-2"
              >
                حذف
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setS({ ...s, booking_visit_types: [...s.booking_visit_types, { label: "", price: 0 }] })
          }
          className="text-sm text-sky-600 font-semibold hover:underline"
        >
          + إضافة نوع زيارة
        </button>
      </section>

      <button
        onClick={save}
        disabled={saving}
        className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-bold py-3 rounded-xl"
      >
        {saving ? "جاري الحفظ..." : "حفظ الإعدادات"}
      </button>
    </div>
  );
}
