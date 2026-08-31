"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import PatientForm from "../patient-form";

export default function NewPatientPage() {
  const router = useRouter();

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <Link href="/patients" className="text-sm text-sky-600 hover:underline">
        ← رجوع لقائمة المرضى
      </Link>
      <h1 className="font-bold text-slate-800 text-lg mt-1 mb-6">إضافة مريض جديد</h1>

      <PatientForm
        submitLabel="إضافة المريض"
        onSubmit={async (payload) => {
          const res = await fetch("/api/patients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const json = await res.json();
          if (!res.ok) {
            throw new Error(json?.error ?? "تعذّر إضافة المريض");
          }
          router.push(`/patients/${json.data.id}`);
        }}
      />
    </div>
  );
}
