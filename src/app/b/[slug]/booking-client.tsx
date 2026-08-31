"use client";

import { useCallback, useEffect, useState } from "react";

interface VisitType {
  label: string;
  price: number;
}

interface BookingSuccess {
  id: string;
  token: string;
  patient_name: string;
  date: string;
  time: string;
  visit_label: string;
  price: number;
  clinic_name: string;
}

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function fmtDateAr(dateStr: string) {
  const d = new Date(`${dateStr}T12:00:00`);
  return `${DAYS_AR[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export default function BookingClient({
  slug,
  clinicName,
  address,
  phone,
  doctorName,
  visitTypes,
  defaultDate,
}: {
  slug: string;
  clinicName: string;
  address: string;
  phone: string;
  doctorName: string;
  visitTypes: VisitType[];
  defaultDate: string;
}) {
  const [date, setDate] = useState(defaultDate);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState("");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    age: "",
    gender: "male" as "male" | "female",
    visit_label: visitTypes[0]?.label ?? "",
    time: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<BookingSuccess | null>(null);

  const loadSlots = useCallback(async () => {
    setSlotsLoading(true);
    setSlotsError("");
    setForm((f) => ({ ...f, time: "" }));
    try {
      const res = await fetch(`/api/public/book/${slug}?date=${date}`);
      const json = await res.json();
      if (!res.ok) {
        setSlotsError(json.error ?? "تعذّر تحميل المواعيد");
        setSlots([]);
      } else {
        setSlots(json.data.slots ?? []);
      }
    } catch {
      setSlotsError("تعذّر الاتصال — تحقق من الإنترنت");
    } finally {
      setSlotsLoading(false);
    }
  }, [slug, date]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("");
    setErrors({});

    const errs: Record<string, string> = {};
    if (form.full_name.trim().length < 3) errs.full_name = "اكتب الاسم بالكامل";
    if (form.phone.replace(/[^0-9]/g, "").length < 8) errs.phone = "رقم هاتف غير صحيح";
    if (!form.visit_label) errs.visit_label = "اختر نوع الزيارة";
    if (!form.time) errs.time = "اختر موعدًا";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/book/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name,
          phone: form.phone,
          age: form.age ? Number(form.age) : null,
          gender: form.gender,
          visit_label: form.visit_label,
          date,
          time: form.time,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.issues) setErrors(json.issues);
        setSubmitError(json.error ?? "فشل الحجز — حاول مرة أخرى");
      } else {
        setSuccess(json.data as BookingSuccess);
      }
    } catch {
      setSubmitError("تعذّر الاتصال بالخادم — تحقق من الإنترنت وحاول مرة أخرى");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    const trackUrl = `/b/${slug}/track/${success.token}`;
    return (
      <div dir="rtl" className="min-h-screen bg-sky-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-sky-100 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center text-3xl mb-4">
            ✅
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">تم تأكيد حجزك!</h1>
          <p className="text-slate-500 mb-6">
            مستنيينك في {success.clinic_name}
          </p>
          <div className="bg-sky-50 rounded-xl p-4 text-right space-y-2 text-sm mb-6">
            <Row label="الاسم" value={success.patient_name} />
            <Row label="اليوم" value={fmtDateAr(success.date)} />
            <Row label="الميعاد" value={success.time} />
            <Row label="الزيارة" value={`${success.visit_label} — ${success.price} ج.م`} />
          </div>
          <p className="text-xs text-slate-400 mb-4">
            احتفظ برابط المتابعة ده عشان تشوف حالة حجزك ورقم دورك يوم الكشف:
          </p>
          <a
            href={trackUrl}
            className="block w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            متابعة الحجز ورقم الدور
          </a>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-sky-50">
      {/* هيدر العيادة */}
      <header className="bg-sky-700 text-white">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold">{clinicName}</h1>
          <p className="text-sky-100 text-sm mt-1">
            {doctorName ? `مع ${doctorName}` : ""}
            {address ? ` — ${address}` : ""}
            {phone ? ` — 📞 ${phone}` : ""}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-1">احجز موعدك أونلاين</h2>
          <p className="text-sm text-slate-500 mb-6">متاح 24 ساعة — اختار اليوم والميعاد المناسبين</p>

          <form onSubmit={submit} className="space-y-5">
            {/* اليوم */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">📅 اليوم</label>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
                  const d = new Date();
                  d.setDate(d.getDate() + offset);
                  const ds = d.toISOString().slice(0, 10);
                  const isSelected = ds === date;
                  return (
                    <button
                      type="button"
                      key={ds}
                      onClick={() => setDate(ds)}
                      className={`px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                        isSelected
                          ? "bg-sky-600 text-white border-sky-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                      }`}
                    >
                      {offset === 0 ? "النهاردة" : DAYS_AR[d.getDay()]}
                      <span className="block text-xs opacity-75">
                        {d.getDate()}/{d.getMonth() + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 mt-1">{fmtDateAr(date)}</p>
            </div>

            {/* الميعاد */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">🕐 الميعاد</label>
              {slotsLoading && <p className="text-sm text-slate-400">جاري تحميل المواعيد المتاحة...</p>}
              {slotsError && <p className="text-sm text-red-500">{slotsError}</p>}
              {!slotsLoading && !slotsError && slots.length === 0 && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  مفيش مواعيد فاضية في اليوم ده — جرب يوم تاني.
                </p>
              )}
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                {slots.map((s) => (
                  <button
                    type="button"
                    key={s}
                    onClick={() => setForm({ ...form, time: s })}
                    className={`py-2 rounded-lg border text-sm font-medium transition-colors ${
                      form.time === s
                        ? "bg-sky-600 text-white border-sky-600"
                        : "bg-white text-slate-700 border-slate-200 hover:border-sky-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {errors.time && <p className="text-xs text-red-500 mt-1">{errors.time}</p>}
            </div>

            {/* نوع الزيارة */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">🩺 نوع الزيارة</label>
              <div className="flex flex-wrap gap-2">
                {visitTypes.map((vt) => (
                  <button
                    type="button"
                    key={vt.label}
                    onClick={() => setForm({ ...form, visit_label: vt.label })}
                    className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      form.visit_label === vt.label
                        ? "bg-sky-600 text-white border-sky-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                    }`}
                  >
                    {vt.label} — {vt.price} ج.م
                  </button>
                ))}
              </div>
              {errors.visit_label && <p className="text-xs text-red-500 mt-1">{errors.visit_label}</p>}
            </div>

            <hr className="border-slate-100" />

            {/* البيانات */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="الاسم بالكامل" error={errors.full_name}>
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="مثال: أحمد محمد"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
                />
              </Field>
              <Field label="رقم الهاتف" error={errors.phone}>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500 text-left"
                />
              </Field>
              <Field label="السن (اختياري)">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
                />
              </Field>
              <Field label="النوع">
                <div className="flex gap-2">
                  {(["male", "female"] as const).map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => setForm({ ...form, gender: g })}
                      className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        form.gender === g
                          ? "bg-sky-600 text-white border-sky-600"
                          : "bg-white text-slate-600 border-slate-200"
                      }`}
                    >
                      {g === "male" ? "ذكر" : "أنثى"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <Field label="ملاحظات (اختياري)">
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="أي أعراض أو ملاحظات تريد إخبار العيادة بها..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
              />
            </Field>

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{submitError}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-bold py-3.5 rounded-xl transition-colors text-lg"
            >
              {submitting ? "جاري تأكيد الحجز..." : "تأكيد الحجز"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-400 mt-4">
          الحجز مجاني — الدفع في العيادة يوم الكشف.
        </p>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
