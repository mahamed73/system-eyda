"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PatientPicker from "@/components/patient-picker";
import type { Patient } from "@/lib/patients/types";

interface VisitSummary {
  id: string;
  visit_date: string;
  diagnosis: string | null;
  prescription: string | null;
  price: string;
  doctor_name: string;
  total_paid: string;
  follow_up_date: string | null;
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function CompareInner() {
  const searchParams = useSearchParams();
  const presetPatient = searchParams.get("patientId");

  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<VisitSummary[]>([]);
  const [left, setLeft] = useState<string>("");
  const [right, setRight] = useState<string>("");

  useEffect(() => {
    if (!presetPatient) return;
    fetch(`/api/patients/${presetPatient}`)
      .then((r) => r.json())
      .then((json) => {
        if (json?.data) {
          setPatient(json.data);
          setVisits(json.data.visits ?? []);
          if (json.data.visits?.[0]) setRight(json.data.visits[0].id);
          if (json.data.visits?.[1]) setLeft(json.data.visits[1].id);
        }
      });
  }, [presetPatient]);

  function onPick(p: Patient | null) {
    setPatient(p);
    setVisits([]);
    setLeft("");
    setRight("");
    if (!p) return;
    fetch(`/api/patients/${p.id}`)
      .then((r) => r.json())
      .then((json) => {
        const v: VisitSummary[] = json?.data?.visits ?? [];
        setVisits(v);
        if (v[0]) setRight(v[0].id);
        if (v[1]) setLeft(v[1].id);
      });
  }

  const leftVisit = visits.find((v) => v.id === left) ?? null;
  const rightVisit = visits.find((v) => v.id === right) ?? null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/patients" className="text-sm text-sky-600 hover:underline">
        ← رجوع
      </Link>
      <h1 className="font-bold text-slate-800 text-lg mt-1 mb-6">🔍 مقارنة الزيارات</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
        <label className="block text-sm font-medium text-slate-700 mb-2">اختر المريض</label>
        <PatientPicker value={patient} onChange={onPick} />
        {visits.length < 2 && patient && (
          <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mt-3">
            المريض عنده أقل من زيارتين — مفيش حاجة تُقارَن.
          </p>
        )}
      </div>

      {visits.length >= 2 && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <VisitSelect label="الزيارة السابقة" visits={visits} value={left} onChange={setLeft} />
            <VisitSelect label="زيارة اليوم / الأحدث" visits={visits} value={right} onChange={setRight} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <VisitCard visit={leftVisit} muted />
            <VisitCard visit={rightVisit} highlight />
          </div>
        </>
      )}
    </div>
  );
}

function VisitSelect({
  label,
  visits,
  value,
  onChange,
}: {
  label: string;
  visits: VisitSummary[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
      >
        <option value="">اختر زيارة...</option>
        {visits.map((v) => (
          <option key={v.id} value={v.id}>
            {fmtDate(v.visit_date)} — {v.doctor_name}
          </option>
        ))}
      </select>
    </div>
  );
}

function VisitCard({ visit, highlight, muted }: { visit: VisitSummary | null; highlight?: boolean; muted?: boolean }) {
  if (!visit) {
    return (
      <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
        اختر زيارة للعرض
      </div>
    );
  }
  return (
    <div
      className={`rounded-xl border p-5 ${
        highlight
          ? "border-sky-300 bg-sky-50/50"
          : muted
            ? "border-slate-200 bg-slate-50"
            : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="font-bold text-slate-800">{fmtDate(visit.visit_date)}</p>
        <span className="text-xs text-slate-400">{visit.doctor_name}</span>
      </div>
      <Section label="التشخيص" value={visit.diagnosis} />
      <Section label="الروشتة / العلاج" value={visit.prescription} />
      <div className="mt-4 pt-3 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-slate-400">السعر: </span>
          <span className="font-semibold text-slate-700">{visit.price} ج.م</span>
        </div>
        <div>
          <span className="text-slate-400">المدفوع: </span>
          <span className="font-semibold text-green-600">{visit.total_paid} ج.م</span>
        </div>
      </div>
      {visit.follow_up_date && (
        <p className="text-xs text-sky-600 mt-2">📅 متابعة محددة: {fmtDate(visit.follow_up_date)}</p>
      )}
    </div>
  );
}

function Section({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-semibold text-slate-400 mb-1">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
        {value?.trim() ? value : "—"}
      </p>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense>
      <CompareInner />
    </Suspense>
  );
}
