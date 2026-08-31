"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PatientPicker from "@/components/patient-picker";
import type { Patient } from "@/lib/patients/types";

interface Doctor {
  id: string;
  name: string;
}

type VisitType = "checkup" | "follow_up";

const visitTypeLabels: Record<VisitType, string> = {
  checkup: "كشف",
  follow_up: "متابعة",
};

function toDatetimeLocalDefault(dateParam: string | null) {
  const base = dateParam ? new Date(`${dateParam}T09:00:00`) : new Date();
  if (!dateParam) {
    base.setMinutes(0, 0, 0);
    base.setHours(base.getHours() + 1);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
}

function NewAppointmentForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [scheduledAt, setScheduledAt] = useState(toDatetimeLocalDefault(dateParam));
  const [duration, setDuration] = useState(15);
  const [visitType, setVisitType] = useState<VisitType>("checkup");
  const [price, setPrice] = useState("");
  const [hasChronicDisease, setHasChronicDisease] = useState<"" | "yes" | "no">("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((json) => {
        setDoctors(json.data ?? []);
        if (json.data?.length === 1) setDoctorId(json.data[0].id);
      });
  }, []);

  // بنحدّث إجابة سؤال "مرض مزمن؟" مباشرة لحظة اختيار المريض (مش جوه
  // useEffect) عشان نعرض إجابته المسجّلة قبل كده لو موجودة.
  function handlePatientChange(next: Patient | null) {
    setPatient(next);
    setHasChronicDisease(
      next?.has_chronic_disease === true ? "yes" : next?.has_chronic_disease === false ? "no" : ""
    );
  }

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
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patient.id,
          doctor_id: doctorId,
          scheduled_at: new Date(scheduledAt).toISOString(),
          duration_minutes: duration,
          visit_type: visitType,
          price: price ? Number(price) : null,
          patient_has_chronic_disease:
            hasChronicDisease === "yes" ? true : hasChronicDisease === "no" ? false : null,
          notes: notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? "تعذّر حجز الموعد");
      }
      const day = scheduledAt.slice(0, 10);
      router.push(`/appointments?date=${day}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/appointments" className="text-sm text-sky-600 hover:underline">
        ← رجوع للمواعيد
      </Link>
      <h1 className="font-bold text-slate-800 text-lg mt-1 mb-6">حجز موعد جديد</h1>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-slate-200 rounded-xl p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">المريض *</label>
            <PatientPicker value={patient} onChange={handlePatientChange} />
            <Link href="/patients/new" className="text-xs text-sky-600 hover:underline mt-1 inline-block">
              + مريض غير موجود؟ إضافة مريض جديد
            </Link>
            {patient?.allergies_notes && (
              <p className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2 mt-2">
                🚫 ملاحظة هامة عن المريض: {patient.allergies_notes}
              </p>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
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

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">المدة (دقيقة)</label>
              <input
                type="number"
                min={5}
                max={240}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">نوع الزيارة *</label>
              <select
                required
                value={visitType}
                onChange={(e) => setVisitType(e.target.value as VisitType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="checkup">{visitTypeLabels.checkup}</option>
                <option value="follow_up">{visitTypeLabels.follow_up}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {visitType === "checkup" ? "سعر الكشف (ج.م)" : "سعر المتابعة (ج.م)"}
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">التاريخ والوقت *</label>
            <input
              type="datetime-local"
              required
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">هل لدى المريض مرض مزمن؟</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="radio"
                  name="has_chronic_disease"
                  checked={hasChronicDisease === "yes"}
                  onChange={() => setHasChronicDisease("yes")}
                />
                نعم
              </label>
              <label className="flex items-center gap-1.5 text-sm text-slate-700">
                <input
                  type="radio"
                  name="has_chronic_disease"
                  checked={hasChronicDisease === "no"}
                  onChange={() => setHasChronicDisease("no")}
                />
                لا
              </label>
              <label className="flex items-center gap-1.5 text-sm text-slate-500">
                <input
                  type="radio"
                  name="has_chronic_disease"
                  checked={hasChronicDisease === ""}
                  onChange={() => setHasChronicDisease("")}
                />
                غير محدد
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ملاحظات</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
            {isSubmitting ? "جاري الحجز..." : "تأكيد الحجز"}
          </button>
        </form>
    </div>
  );
}

export default function NewAppointmentPage() {
  return (
    <Suspense fallback={null}>
      <NewAppointmentForm />
    </Suspense>
  );
}
