"use client";

import { useEffect, useRef, useState } from "react";
import type { Patient } from "@/lib/patients/types";

interface DuplicateResult {
  exact_phone: { id: string; full_name: string; phone: string }[];
  similar_name: { id: string; full_name: string; phone: string; similarity: number }[];
}

export interface PatientFormValues {
  full_name: string;
  phone: string;
  age: string;
  gender: "" | "male" | "female";
  address: string;
  allergies_notes: string;
  has_chronic_disease: "" | "yes" | "no";
  blood_type: "" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

function patientToFormValues(patient?: Patient | null): PatientFormValues {
  return {
    full_name: patient?.full_name ?? "",
    phone: patient?.phone ?? "",
    age: patient?.age != null ? String(patient.age) : "",
    gender: (patient?.gender as "male" | "female" | undefined) ?? "",
    address: patient?.address ?? "",
    allergies_notes: patient?.allergies_notes ?? "",
    has_chronic_disease:
      patient?.has_chronic_disease === true ? "yes" : patient?.has_chronic_disease === false ? "no" : "",
    blood_type: ((patient as { blood_type?: string } | null | undefined)?.blood_type as PatientFormValues["blood_type"]) ?? "",
  };
}

interface PatientFormProps {
  initialPatient?: Patient | null;
  submitLabel: string;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

export default function PatientForm({ initialPatient, submitLabel, onSubmit }: PatientFormProps) {
  const [values, setValues] = useState<PatientFormValues>(patientToFormValues(initialPatient));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateResult | null>(null);
  const dupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // فحص الازدواجية (رقم التليفون أو اسم قريب) مع debounce
  useEffect(() => {
    if (dupTimer.current) clearTimeout(dupTimer.current);
    const name = values.full_name.trim();
    const phone = values.phone.trim();
    dupTimer.current = setTimeout(async () => {
      if (!name && !phone) {
        setDuplicates(null);
        return;
      }
      try {
        const params = new URLSearchParams();
        if (phone) params.set("phone", phone);
        if (name) params.set("name", name);
        if (initialPatient?.id) params.set("exclude", initialPatient.id);
        const res = await fetch(`/api/patients/check-duplicate?${params.toString()}`);
        if (!res.ok) return;
        const json = await res.json();
        setDuplicates(json.data);
      } catch {
        // نتجاهل
      }
    }, 400);
    return () => {
      if (dupTimer.current) clearTimeout(dupTimer.current);
    };
  }, [values.full_name, values.phone, initialPatient?.id]);

  const hasExactPhone = duplicates && duplicates.exact_phone.length > 0;
  const hasSimilarName = duplicates && duplicates.similar_name.length > 0;

  function update<K extends keyof PatientFormValues>(key: K, value: PatientFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit({
        full_name: values.full_name,
        phone: values.phone,
        age: values.age ? Number(values.age) : null,
        gender: values.gender || null,
        address: values.address || null,
        allergies_notes: values.allergies_notes || null,
        has_chronic_disease:
          values.has_chronic_disease === "yes" ? true : values.has_chronic_disease === "no" ? false : null,
        blood_type: values.blood_type || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-slate-200 rounded-xl p-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">الاسم الكامل *</label>
          <input
            required
            value={values.full_name}
            onChange={(e) => update("full_name", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">رقم التليفون *</label>
          <input
            required
            dir="ltr"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">السن</label>
          <input
            type="number"
            min={0}
            max={150}
            value={values.age}
            onChange={(e) => update("age", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">النوع</label>
          <select
            value={values.gender}
            onChange={(e) => update("gender", e.target.value as PatientFormValues["gender"])}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">غير محدد</option>
            <option value="male">ذكر</option>
            <option value="female">أنثى</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">🩸 فصيلة الدم</label>
          <select
            value={values.blood_type}
            onChange={(e) => update("blood_type", e.target.value as PatientFormValues["blood_type"])}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="">غير محدد</option>
            {BLOOD_TYPES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(hasExactPhone || hasSimilarName) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm">
          <p className="font-medium text-amber-800 mb-1">⚠️ تنبيه: احتمال مريض مكرر</p>
          {hasExactPhone && (
            <p className="text-amber-700 text-xs mb-1">
              نفس رقم التليفون مسجّل لـ:{" "}
              {duplicates!.exact_phone.map((p) => p.full_name).join("، ")}
            </p>
          )}
          {hasSimilarName && (
            <p className="text-amber-700 text-xs">
              اسم قريب من:{" "}
              {duplicates!.similar_name.map((p) => p.full_name).join("، ")}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">العنوان</label>
        <textarea
          value={values.address}
          onChange={(e) => update("address", e.target.value)}
          rows={2}
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
              checked={values.has_chronic_disease === "yes"}
              onChange={() => update("has_chronic_disease", "yes")}
            />
            نعم
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="radio"
              name="has_chronic_disease"
              checked={values.has_chronic_disease === "no"}
              onChange={() => update("has_chronic_disease", "no")}
            />
            لا
          </label>
          <label className="flex items-center gap-1.5 text-sm text-slate-500">
            <input
              type="radio"
              name="has_chronic_disease"
              checked={values.has_chronic_disease === ""}
              onChange={() => update("has_chronic_disease", "")}
            />
            غير محدد
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          ملاحظات هامة (حساسية دواء / دواء ممنوع / أي تنبيه للطبيب)
        </label>
        <textarea
          value={values.allergies_notes}
          onChange={(e) => update("allergies_notes", e.target.value)}
          rows={2}
          placeholder="مثال: يتحسس من البنسلين — ممنوع إعطاؤه أسبرين"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <p className="text-xs text-slate-400 mt-1">
          الملاحظة دي هتظهر في قائمة المرضى مباشرة من غير الحاجة لفتح الملف.
        </p>
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
        {isSubmitting ? "جاري الحفظ..." : submitLabel}
      </button>
    </form>
  );
}
