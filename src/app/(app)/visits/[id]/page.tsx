"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { VisitWithDetails } from "@/lib/visits/types";
import AttachmentsSection from "./attachments-section";
import WhatsAppTemplates from "@/components/whatsapp-templates";

const methodLabels: Record<string, string> = {
  cash: "كاش",
  vodafone_cash: "فودافون كاش",
  instapay: "إنستاباي",
  other: "أخرى",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
}

export default function VisitDetailPage() {
  const params = useParams<{ id: string }>();
  const [visit, setVisit] = useState<VisitWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [diagnosis, setDiagnosis] = useState("");
  const [prescription, setPrescription] = useState("");
  const [price, setPrice] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/visits/${params.id}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "تعذّر تحميل بيانات الزيارة");
        if (!cancelled) {
          setVisit(json.data);
          setDiagnosis(json.data.diagnosis ?? "");
          setPrescription(json.data.prescription ?? "");
          setPrice(String(json.data.price));
          setFollowUpDate(json.data.follow_up_date ?? "");
        }
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!visit) return;
    setIsSaving(true);
    setSavedMessage(null);
    try {
      const res = await fetch(`/api/visits/${visit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosis, prescription, price: Number(price), follow_up_date: followUpDate || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "تعذّر حفظ التعديلات");
      setVisit(json.data);
      setSavedMessage("تم الحفظ ✅");
    } catch (err) {
      setError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!visit) return;
    setPaymentError(null);
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      setPaymentError("أدخل مبلغ صحيح");
      return;
    }
    setIsPaying(true);
    try {
      const res = await fetch(`/api/visits/${visit.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, method: paymentMethod }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "تعذّر تسجيل الدفعة");
      setVisit(json.data);
      setPaymentAmount("");
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "حصل خطأ غير متوقع");
    } finally {
      setIsPaying(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      {visit && (
        <Link href={`/patients/${visit.patient_id}`} className="text-sm text-sky-600 hover:underline">
          ← رجوع لملف المريض
        </Link>
      )}
      <h1 className="font-bold text-slate-800 text-lg mt-1">
        {visit ? `كشف ${visit.patient_name}` : "تفاصيل الكشف"}
      </h1>

        {loading && <p className="text-slate-400 text-sm">جاري التحميل...</p>}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!loading && visit && (
          <>
            <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500">
              <p>التاريخ: {formatDate(visit.visit_date)}</p>
              <p>الطبيب: د. {visit.doctor_name}</p>
              <div className="flex items-center gap-2">
                <span dir="ltr">{visit.patient_phone}</span>
                {visit.patient_phone && (
                  <WhatsAppTemplates
                    patientName={visit.patient_name ?? ""}
                    phone={visit.patient_phone}
                  />
                )}
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-4 bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-semibold text-slate-800">بيانات الكشف</h2>

              <div>
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
                <label className="block text-sm font-medium text-slate-700 mb-1">سعر الكشف (ج.م)</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
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
              </div>

              {savedMessage && <p className="text-sm text-emerald-700">{savedMessage}</p>}

              <button
                type="submit"
                disabled={isSaving}
                className="bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-medium rounded-lg px-5 py-2.5 transition-colors"
              >
                {isSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <h2 className="font-semibold text-slate-800 mb-3">المدفوعات</h2>

              <div className="flex items-center justify-between text-sm mb-4 bg-slate-50 rounded-lg p-3">
                <span>السعر: {Number(visit.price)} ج.م</span>
                <span>المدفوع: {visit.total_paid} ج.م</span>
                <span
                  className={visit.remaining_balance > 0 ? "text-amber-700 font-medium" : "text-emerald-700 font-medium"}
                >
                  {visit.remaining_balance > 0 ? `متبقي: ${visit.remaining_balance} ج.م` : "مدفوع بالكامل"}
                </span>
              </div>

              {visit.payments.length > 0 && (
                <ul className="space-y-1 mb-4 text-sm text-slate-600">
                  {visit.payments.map((p) => (
                    <li key={p.id} className="flex justify-between border-b border-slate-50 pb-1">
                      <span>{methodLabels[p.method ?? "other"]}</span>
                      <span>{p.amount} ج.م</span>
                      <span className="text-xs text-slate-400">{formatDate(p.paid_at)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {visit.remaining_balance > 0 && (
                <form onSubmit={handleAddPayment} className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">مبلغ جديد</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 w-32 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">طريقة الدفع</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {Object.entries(methodLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={isPaying}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
                  >
                    {isPaying ? "جاري التسجيل..." : "تسجيل دفعة"}
                  </button>
                </form>
              )}
              {paymentError && <p className="text-sm text-red-600 mt-2">{paymentError}</p>}
            </div>

            <AttachmentsSection visitId={visit.id} />
          </>
        )}
    </div>
  );
}
