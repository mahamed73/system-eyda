"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PatientPicker from "@/components/patient-picker";
import DiagnosisPicker from "@/components/diagnosis-picker";
import type { Patient } from "@/lib/patients/types";

interface Doctor {
  id: string;
  name: string;
}

interface AppointmentInfo {
  id: string;
  visit_type: "checkup" | "follow_up";
  price: string | null;
}

const methodLabels: Record<string, string> = {
  cash: "كاش",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
  other: "أخرى",
};

const visitTypeLabels: Record<string, string> = {
  checkup: "كشف",
  follow_up: "متابعة",
};

function NewVisitForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientIdParam = searchParams.get("patientId");
  const appointmentIdParam = searchParams.get("appointmentId");
  const doctorIdParam = searchParams.get("doctorId");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctorId, setDoctorId] = useState(doctorIdParam ?? "");
  const [appointmentInfo, setAppointmentInfo] = useState<AppointmentInfo | null>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [prescription, setPrescription] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [recordPayment, setRecordPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((json) => {
        setDoctors(json.data ?? []);
        if (!doctorIdParam && json.data?.length === 1) setDoctorId(json.data[0].id);
      });
  }, [doctorIdParam]);

  useEffect(() => {
    if (!patientIdParam) return;
    fetch(`/api/patients/${patientIdParam}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) setPatient(json.data);
      });
  }, [patientIdParam]);

  // لو الكشف جاي من موعد محجوز، نجيب نوع الزيارة والسعر اللي اتحددوا
  // وقت الحجز — من غير ما نطلب من المستخدم يكتبهم تاني.
  useEffect(() => {
    if (!appointmentIdParam) return;
    fetch(`/api/appointments/${appointmentIdParam}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) {
          setAppointmentInfo(json.data);
          if (json.data.price) setPaymentAmount(String(json.data.price));
        }
      });
  }, [appointmentIdParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!patient) {
      setError("لازم تختار مريض أولاً");
      return;
    }
    if (!doctorId) {
      setError("لازم تختار الطبيب");
      return;
    }

    setIsSubmitting(true);
    try {
      const amount = paymentAmount ? Number(paymentAmount) : 0;
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patient.id,
          doctor_id: doctorId,
          appointment_id: appointmentIdParam || null,
          diagnosis: diagnosis || null,
          prescription: prescription || null,
          follow_up_date: followUpDate || null,
          initial_payment: recordPayment && amount > 0 ? { amount, method: paymentMethod } : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "تعذّر تسجيل الكشف");
      }
      router.push(`/visits/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/patients" className="text-sm text-sky-600 hover:underline">
        ← رجوع
      </Link>
      <h1 className="font-bold text-slate-800 text-lg mt-1 mb-6">تسجيل كشف / زيارة جديدة</h1>

        {appointmentInfo && (
          <div className="bg-sky-50 border border-sky-200 text-sky-800 rounded-lg px-4 py-2.5 mb-4 text-sm flex items-center justify-between">
            <span>نوع الزيارة: {visitTypeLabels[appointmentInfo.visit_type]}</span>
            <span>
              السعر المحدّد وقت الحجز:{" "}
              <strong>{appointmentInfo.price != null ? `${appointmentInfo.price} ج.م` : "غير محدد"}</strong>
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-slate-200 rounded-xl p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المريض *</label>
            <PatientPicker value={patient} onChange={setPatient} />
            {patient?.allergies_notes && (
              <p className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 mt-2">
                🚫 ملاحظة هامة عن المريض: {patient.allergies_notes}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الطبيب *</label>
            <select
              required
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">اختر الطبيب</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <DiagnosisPicker
              onPick={(d) => {
                if (d.diagnosis) setDiagnosis((prev) => (prev ? prev : d.diagnosis));
                if (d.prescription) setPrescription((prev) => (prev ? prev : d.prescription));
              }}
            />
            <label className="block text-sm font-medium text-slate-700 mb-1">التشخيص</label>
            <textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">الوصفة / العلاج</label>
            <textarea
              value={prescription}
              onChange={(e) => setPrescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              تاريخ المتابعة (اختياري)
            </label>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="w-full sm:w-56 rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              لو المريض محتاج يرجع تاني، حدّد التاريخ وهيفتكرك النظام ويطلّع تنبيه للسكرتارية.
            </p>
          </div>

          <div className="border border-slate-200 rounded-lg p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={recordPayment}
                onChange={(e) => setRecordPayment(e.target.checked)}
              />
              تسجيل دفعة الآن
            </label>
            {recordPayment && (
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">المبلغ (ج.م)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">طريقة الدفع</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {Object.entries(methodLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
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
            {isSubmitting ? "جاري الحفظ..." : "حفظ الكشف"}
          </button>
        </form>
    </div>
  );
}

export default function NewVisitPage() {
  return (
    <Suspense fallback={null}>
      <NewVisitForm />
    </Suspense>
  );
}
