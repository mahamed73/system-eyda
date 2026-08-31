"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PatientListItem } from "@/lib/patients/types";
import Pagination from "@/components/pagination";
import WhatsAppLink from "@/components/whatsapp-link";

interface PatientsResponse {
  data: PatientListItem[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

const genderLabels: Record<string, string> = { male: "ذكر", female: "أنثى" };

export default function PatientsPageClient() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [chronic, setChronic] = useState("");
  const [hasNotes, setHasNotes] = useState("");
  const [gender, setGender] = useState("");
  const [activity, setActivity] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [result, setResult] = useState<PatientsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (chronic) params.set("chronic", chronic);
        if (hasNotes) params.set("has_notes", hasNotes);
        if (gender) params.set("gender", gender);
        if (activity) params.set("activity", activity);

        const res = await fetch(`/api/patients?${params.toString()}`);
        if (!res.ok) throw new Error("تعذّر تحميل بيانات المرضى");
        const json = (await res.json()) as PatientsResponse;
        if (!cancelled) setResult(json);
      } catch {
        if (!cancelled) setError("حصل خطأ أثناء تحميل بيانات المرضى");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, page, pageSize, chronic, hasNotes, gender, activity]);

  function handlePageSizeChange(size: number) {
    setPageSize(size);
    setPage(1);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-5">
        <h1 className="font-bold text-slate-800 text-lg">ملفات المرضى</h1>
        <Link
          href="/patients/new"
          className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          + إضافة مريض جديد
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو رقم التليفون..."
          className="w-full sm:w-72 rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
        />
        <select
          value={chronic}
          onChange={(e) => { setChronic(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700"
        >
          <option value="">مرض مزمن: الكل</option>
          <option value="yes">عنده مرض مزمن</option>
          <option value="no">مفيش مرض مزمن</option>
        </select>
        <select
          value={hasNotes}
          onChange={(e) => { setHasNotes(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700"
        >
          <option value="">ملاحظات: الكل</option>
          <option value="yes">عنده ملاحظات هامة</option>
          <option value="no">من غير ملاحظات</option>
        </select>
        <select
          value={gender}
          onChange={(e) => { setGender(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700"
        >
          <option value="">النوع: الكل</option>
          <option value="male">ذكر</option>
          <option value="female">أنثى</option>
        </select>
        <select
          value={activity}
          onChange={(e) => { setActivity(e.target.value); setPage(1); }}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700"
        >
          <option value="">النشاط: الكل</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-right">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">الاسم</th>
              <th className="px-4 py-3 font-medium">التليفون</th>
              <th className="px-4 py-3 font-medium">السن</th>
              <th className="px-4 py-3 font-medium">النوع</th>
              <th className="px-4 py-3 font-medium">ملاحظات هامة</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  جاري التحميل...
                </td>
              </tr>
            )}
            {!loading && result?.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  لا يوجد مرضى مسجلين{debouncedSearch ? " مطابقين للبحث" : ""}.
                </td>
              </tr>
            )}
            {!loading &&
              result?.data.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <span className="inline-flex items-center gap-1.5">
                      {p.full_name}
                      {p.is_inactive && (
                        <span
                          className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 rounded-full px-2 py-0.5 whitespace-nowrap"
                          title="مفيش زيارة في آخر 3 شهور"
                        >
                          غير نشط
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="inline-flex items-center gap-2">
                      <span dir="ltr">{p.phone}</span>
                      <WhatsAppLink phone={p.phone} title={`مراسلة ${p.full_name} على واتساب`} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.age ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.gender ? genderLabels[p.gender] : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {p.has_chronic_disease && (
                        <span
                          className="text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 whitespace-nowrap"
                          title="لدى المريض مرض مزمن"
                        >
                          ⚠️ مرض مزمن
                        </span>
                      )}
                      {p.allergies_notes && (
                        <span
                          className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-full px-2 py-0.5 truncate max-w-[200px]"
                          title={p.allergies_notes}
                        >
                          🚫 {p.allergies_notes}
                        </span>
                      )}
                      {!p.has_chronic_disease && !p.allergies_notes && (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                      <Link href={`/encounter/${p.id}`} className="text-sky-600 hover:underline">
                        الكشف المختصر
                      </Link>
                      <Link href={`/patients/${p.id}`} className="text-slate-600 hover:underline">
                        عرض / تعديل
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {result && result.pagination && (
        <Pagination
          page={result.pagination.page}
          totalPages={result.pagination.totalPages}
          pageSize={result.pagination.pageSize}
          total={result.pagination.total}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}
