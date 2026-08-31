"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import WhatsAppTemplates from "@/components/whatsapp-templates";

interface WinbackPatient {
  id: string;
  full_name: string;
  phone: string;
  last_visit_date: string | null;
  months_since: number;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "لم يزر من قبل";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function WinbackPage() {
  const [patients, setPatients] = useState<WinbackPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/patients/winback");
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "تعذّر تحميل البيانات");
        if (!cancelled) setPatients(json.data ?? []);
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
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="font-bold text-slate-800 text-lg">استعادة المرضى الغائبين</h1>
        <Link href="/patients" className="text-sm text-sky-600 hover:underline">
          ← رجوع للمرضى
        </Link>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        المرضى اللي مجوش العيادة من 6 شهور أو أكتر — راسلهم على واتساب بضغطة واحدة عشان ترجعهم.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading && <p className="text-slate-400 text-sm">جاري التحميل...</p>}

      {!loading && patients.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-500 mb-2">مفيش مرضى غائبين 🎉</p>
          <p className="text-sm text-slate-400">كل مرضاك زاروا العيادة في آخر 6 شهور.</p>
        </div>
      )}

      {!loading && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">الاسم</th>
                <th className="px-4 py-3 font-medium">التليفون</th>
                <th className="px-4 py-3 font-medium">آخر زيارة</th>
                <th className="px-4 py-3 font-medium">غائب منذ</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.full_name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <span dir="ltr">{p.phone}</span>
                      <WhatsAppTemplates patientName={p.full_name} phone={p.phone} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(p.last_visit_date)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2.5 py-0.5">
                      {p.months_since} شهر
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <Link href={`/patients/${p.id}`} className="text-sky-600 hover:underline">
                      الملف
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
