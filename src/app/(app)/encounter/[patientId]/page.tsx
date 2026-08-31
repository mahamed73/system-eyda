"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { EncounterSummary } from "@/lib/encounter/queries";

const genderLabels: Record<string, string> = {
  male: "ذكر",
  female: "أنثى",
};

const visitTypeLabels: Record<string, string> = {
  checkup: "كشف",
  follow_up: "متابعة",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function EncounterPage() {
  const params = useParams<{ patientId: string }>();
  const [data, setData] = useState<EncounterSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/encounter/${params.patientId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "تعذّر تحميل بيانات المريض");
        if (!cancelled) setData(json.data);
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
  }, [params.patientId]);

  const p = data?.patient;

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link
          href={p ? `/patients/${p.id}` : "/patients"}
          className="text-sm text-sky-600 hover:underline"
        >
          ← رجوع لملف المريض
        </Link>
        <span className="text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-3 py-1">
          🩺 وضع الكشف
        </span>
      </div>

      {loading && <p className="text-slate-400 text-sm">جاري التحميل...</p>}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!loading && p && data && (
        <>
          {/* اسم المريض والبيانات الأساسية */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
            <h1 className="text-2xl font-bold text-slate-900">{p.full_name}</h1>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-sm text-slate-600">
              {p.age != null && <span>العمر: {p.age} سنة</span>}
              {p.gender && <span>النوع: {genderLabels[p.gender] ?? p.gender}</span>}
              <span dir="ltr">{p.phone}</span>
              <span className="text-slate-400">
                عدد الكشوفات: {data.visits_count}
              </span>
            </div>
          </div>

          {/* التنبيهات الهامة */}
          {p.allergies_notes && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-red-700 mb-1">🚫 ملاحظة هامة / حساسية</p>
              <p className="text-sm text-red-800">{p.allergies_notes}</p>
            </div>
          )}
          {p.has_chronic_disease && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-semibold text-amber-700">⚠️ المريض عنده مرض مزمن</p>
            </div>
          )}

          {/* آخر زيارة */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-4">
            <h2 className="font-semibold text-slate-800 mb-3 text-sm">آخر زيارة</h2>
            {data.last_visit ? (
              <div className="space-y-2 text-sm">
                <p className="text-slate-500 text-xs">
                  {formatDateTime(data.last_visit.visit_date)} — د. {data.last_visit.doctor_name}
                </p>
                {data.last_visit.diagnosis && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">التشخيص</p>
                    <p className="text-slate-800">{data.last_visit.diagnosis}</p>
                  </div>
                )}
                {data.last_visit.prescription && (
                  <div>
                    <p className="text-xs font-medium text-slate-500">العلاج / الروشتة</p>
                    <p className="text-slate-800 whitespace-pre-wrap">{data.last_visit.prescription}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-400">مفيش زيارات سابقة لهذا المريض.</p>
            )}
          </div>

          {/* المواعيد القادمة */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
            <h2 className="font-semibold text-slate-800 mb-3 text-sm">المواعيد القادمة</h2>
            {data.upcoming_appointments.length === 0 && (
              <p className="text-sm text-slate-400">مفيش مواعيد قادمة محجوزة.</p>
            )}
            <div className="space-y-2">
              {data.upcoming_appointments.map((a) => (
                <div
                  key={a.scheduled_at}
                  className="flex items-center justify-between border border-slate-100 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">{formatDateTime(a.scheduled_at)}</span>
                  <span className="text-xs text-slate-500">
                    {visitTypeLabels[a.visit_type] ?? a.visit_type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* زرار تسجيل كشف جديد */}
          <Link
            href={`/visits/new?patientId=${p.id}`}
            className="block text-center bg-sky-600 hover:bg-sky-700 text-white font-semibold rounded-xl px-6 py-3.5 transition-colors"
          >
            تسجيل كشف جديد ←
          </Link>
        </>
      )}
    </div>
  );
}
