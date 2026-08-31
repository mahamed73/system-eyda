"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PatientForm from "../patient-form";
import type { Patient } from "@/lib/patients/types";
import WhatsAppTemplates from "@/components/whatsapp-templates";

interface PatientVisitSummary {
  id: string;
  visit_date: string;
  diagnosis: string | null;
  prescription: string | null;
  price: string;
  doctor_name: string;
  total_paid: string;
}

interface PatientWithVisits extends Patient {
  visits: PatientVisitSummary[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<PatientWithVisits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/patients/${params.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "تعذّر تحميل بيانات المريض");
        if (!cancelled) setPatient(json.data);
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
  }, [params.id]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/patients" className="text-sm text-sky-600 hover:underline">
        ← رجوع لقائمة المرضى
      </Link>
      <h1 className="font-bold text-slate-800 text-lg mt-1">
        {patient ? `ملف المريض: ${patient.full_name}` : "ملف المريض"}
      </h1>

      {!loading && patient && (
        <div className="flex flex-wrap items-center gap-3 mt-1 mb-6 text-sm text-slate-500">
          <span dir="ltr">{patient.phone}</span>
          <WhatsAppTemplates patientName={patient.full_name} phone={patient.phone} />
          {patient.blood_type && (
            <span className="bg-red-50 text-red-700 border border-red-200 rounded-full px-2.5 py-0.5 text-xs font-bold">
              🩸 فصيلة الدم {patient.blood_type}
            </span>
          )}
          <Link
            href={`/visits/compare?patientId=${patient.id}`}
            className="mr-auto bg-white border border-slate-300 text-slate-600 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            🔍 مقارنة الزيارات
          </Link>
        </div>
      )}

      {loading && <p className="text-slate-400 text-sm">جاري التحميل...</p>}


        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {savedMessage && (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-4">
            {savedMessage}
          </p>
        )}

        {!loading && patient && (
          <PatientForm
            initialPatient={patient}
            submitLabel="حفظ التعديلات"
            onSubmit={async (payload) => {
              setSavedMessage(null);
              const res = await fetch(`/api/patients/${patient.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });
              const json = await res.json();
              if (!res.ok) {
                throw new Error(json?.error ?? "تعذّر حفظ التعديلات");
              }
              setPatient((prev) => (prev ? { ...prev, ...json.data } : prev));
              setSavedMessage("تم حفظ التعديلات بنجاح ✅");
            }}
          />
        )}

        {!loading && patient && (
          <div className="mt-8 bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">سجل الزيارات</h2>
              <Link
                href={`/visits/new?patientId=${patient.id}`}
                className="text-sm bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-3 py-1.5 transition-colors"
              >
                + إضافة كشف جديد
              </Link>
            </div>

            {patient.visits.length === 0 && (
              <p className="text-sm text-slate-400">مفيش زيارات مسجلة لهذا المريض لسه.</p>
            )}

            <div className="space-y-2">
              {patient.visits.map((v) => {
                const price = Number(v.price);
                const paid = Number(v.total_paid);
                const remaining = price - paid;
                return (
                  <Link
                    key={v.id}
                    href={`/visits/${v.id}`}
                    className="block border border-slate-100 rounded-lg p-3 hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{formatDate(v.visit_date)}</p>
                      <span
                        className={`text-xs rounded-full px-2 py-0.5 border ${
                          remaining > 0
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {remaining > 0 ? `متبقي ${remaining} ج.م` : "مدفوع بالكامل"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">د. {v.doctor_name}</p>
                    {v.diagnosis && <p className="text-sm text-slate-600 mt-1">{v.diagnosis}</p>}
                    <p className="text-xs text-slate-400 mt-1">السعر: {price} ج.م</p>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}
