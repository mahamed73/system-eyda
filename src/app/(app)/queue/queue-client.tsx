"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { showToast } from "@/components/toast-provider";

interface QueueItem {
  id: string;
  queue_number: number | null;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  status: string;
  visit_type: string | null;
  priority: number;
  scheduled_at: string;
  arrived_at: string | null;
  started_at: string | null;
  wait_minutes: number | null;
}

interface Summary {
  waiting_count: number;
  in_consultation_count: number;
  completed_count: number;
  next_number: number;
}

interface BookedToday {
  id: string;
  patient_name: string;
  doctor_name: string;
  scheduled_at: string;
  visit_type: string | null;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  in_consultation: { label: "جوه الكشف", cls: "bg-green-100 text-green-700" },
  arrived: { label: "في الانتظار", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "خلص", cls: "bg-slate-100 text-slate-500" },
};

export default function QueueClient({
  initialQueue,
  initialSummary,
  initialBooked,
  bookingSlug,
}: {
  initialQueue: QueueItem[];
  initialSummary: Summary;
  initialBooked: BookedToday[];
  slug?: string | null;
  bookingSlug?: string | null;
}) {
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [booked] = useState<BookedToday[]>(initialBooked);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/queue", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setQueue(json.data);
        setSummary(json.summary);
      }
    } catch {
      // offline: نعرض آخر بيانات
    }
  }, []);

  useEffect(() => {
    const i = setInterval(load, 15000);
    return () => clearInterval(i);
  }, [load]);

  async function action(appointmentId: string, act: string, label: string) {
    setBusy(appointmentId + act);
    try {
      const res = await fetch(`/api/queue/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
      });
      const json = await res.json();
      if (!res.ok) {
        showToast(json.error ?? "فشل الإجراء", "error");
      } else {
        setQueue(json.queue);
        setSummary(json.summary);
        showToast(label, "success");
      }
    } catch {
      showToast("تعذّر الاتصال بالخادم", "error");
    } finally {
      setBusy(null);
    }
  }

  const inConsult = queue.filter((q) => q.status === "in_consultation");
  const waiting = queue.filter((q) => q.status === "arrived");
  const done = queue.filter((q) => q.status === "completed");

  return (
    <div className="space-y-6">
      {/* العنوان + روابط عامة */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🪑 غرفة الانتظار</h1>
          <p className="text-sm text-slate-500 mt-1">نظام الدور الذكي — ترتيب بالحضور والأولوية</p>
        </div>
        {bookingSlug && (
          <div className="flex gap-2 print:hidden">
            <Link
              href={`/screen/${bookingSlug}`}
              target="_blank"
              className="text-sm bg-slate-800 text-white px-3 py-2 rounded-lg hover:bg-slate-700"
            >
              🖥️ شاشة الانتظار (تلفزيون)
            </Link>
            <Link
              href={`/b/${bookingSlug}`}
              target="_blank"
              className="text-sm bg-sky-600 text-white px-3 py-2 rounded-lg hover:bg-sky-700"
            >
              🌐 صفحة الحجز الأونلاين
            </Link>
          </div>
        )}
      </div>

      {/* ملخص */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="في الانتظار" value={summary.waiting_count} cls="bg-amber-50 border-amber-200 text-amber-700" />
        <StatCard label="جوه الكشف" value={summary.in_consultation_count} cls="bg-green-50 border-green-200 text-green-700" />
        <StatCard label="خلص النهاردة" value={summary.completed_count} cls="bg-slate-50 border-slate-200 text-slate-600" />
      </div>

      {/* جوه الكشف حاليًا */}
      {inConsult.length > 0 && (
        <section className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <h2 className="font-bold text-green-800 mb-3">🩺 جوه الكشف دلوقتي</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {inConsult.map((q) => (
              <PatientCard key={q.id} q={q} onAction={action} busy={busy} />
            ))}
          </div>
        </section>
      )}

      {/* قائمة الانتظار */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <header className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-800">قائمة الانتظار ({waiting.length})</h2>
          <span className="text-xs text-slate-400">مرتبين حسب الأولوية ثم رقم الدور</span>
        </header>
        {waiting.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">مفيش حد مستني حاليًا</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {waiting.map((q) => (
              <li key={q.id}>
                <PatientRow q={q} onAction={action} busy={busy} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* مواعيد محجوزة لسه ماحضرتش */}
      {booked.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <header className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-800">محجوزين وماحضروش لسه ({booked.length})</h2>
          </header>
          <ul className="divide-y divide-slate-100">
            {booked.map((b) => (
              <li key={b.id} className="px-5 py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{b.patient_name}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(b.scheduled_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })} — {b.doctor_name}
                    {b.visit_type === "follow_up" ? " — متابعة" : ""}
                  </p>
                </div>
                <button
                  onClick={() => action(b.id, "arrive", "✅ تم تسجيل الحضور")}
                  disabled={busy === b.id + "arrive"}
                  className="text-sm bg-sky-600 text-white px-4 py-2 rounded-lg hover:bg-sky-700 disabled:opacity-50"
                >
                  تسجيل حضور
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* المكتملون */}
      {done.length > 0 && (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <header className="px-5 py-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-500">المكتملون ({done.length})</h2>
          </header>
          <ul className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
            {done.map((q) => (
              <li key={q.id} className="px-5 py-2.5 flex items-center gap-3 text-sm text-slate-500">
                <span className="w-8 font-bold text-slate-400">{q.queue_number}</span>
                <span className="flex-1 truncate">{q.patient_name}</span>
                <span className="text-xs text-slate-400">{q.doctor_name}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function StatCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-2xl border p-5 text-center ${cls}`}>
      <p className="text-4xl font-black">{value}</p>
      <p className="text-sm font-semibold mt-1 opacity-80">{label}</p>
    </div>
  );
}

function badge(q: QueueItem) {
  return STATUS_BADGE[q.status] ?? { label: q.status, cls: "bg-slate-100" };
}

function PatientRow({
  q,
  onAction,
  busy,
}: {
  q: QueueItem;
  onAction: (id: string, act: string, label: string) => void;
  busy: string | null;
}) {
  const b = badge(q);
  return (
    <div className="px-5 py-3 flex items-center gap-4">
      <span className="text-3xl font-black text-sky-600 w-12 text-center">{q.queue_number ?? "—"}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-slate-800 truncate">
          {q.patient_name}
          {q.priority === 1 && <span className="text-red-500 text-xs mr-2">🚨 أولوية</span>}
        </p>
        <p className="text-xs text-slate-400">
          {q.doctor_name}
          {q.visit_type === "follow_up" ? " — متابعة" : " — كشف"}
          {q.wait_minutes != null && ` — مستني ${q.wait_minutes} دقيقة`}
        </p>
      </div>
      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${b.cls}`}>{b.label}</span>
      <div className="flex gap-1.5">
        <button
          onClick={() => onAction(q.id, "priority", q.priority === 1 ? "تم إلغاء الأولوية" : "🚨 تم تحديد الأولوية")}
          disabled={busy === q.id + "priority"}
          className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
          title="حالة طارئة"
        >
          🚨
        </button>
        <button
          onClick={() => onAction(q.id, "start", "🩺 بدأ الكشف")}
          disabled={busy === q.id + "start"}
          className="text-sm bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          بدء الكشف
        </button>
      </div>
    </div>
  );
}

function PatientCard({
  q,
  onAction,
  busy,
}: {
  q: QueueItem;
  onAction: (id: string, act: string, label: string) => void;
  busy: string | null;
}) {
  return (
    <div className="bg-white rounded-xl p-4 flex items-center gap-4">
      <span className="text-3xl font-black text-green-600 w-12 text-center">{q.queue_number}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-slate-800 truncate">{q.patient_name}</p>
        <p className="text-xs text-slate-400">{q.doctor_name}</p>
      </div>
      <div className="flex gap-1.5">
        <Link
          href={`/visits/new?patientId=${q.patient_id}&appointmentId=${q.id}`}
          className="text-sm bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700"
        >
          تسجيل الكشف
        </Link>
        <button
          onClick={() => onAction(q.id, "complete", "✅ تم إنهاء الكشف")}
          disabled={busy === q.id + "complete"}
          className="text-sm border border-slate-300 text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50"
        >
          إنهاء
        </button>
        <button
          onClick={() => onAction(q.id, "back", "تم الإرجاع للانتظار")}
          disabled={busy === q.id + "back"}
          className="text-xs border border-slate-200 text-slate-500 px-2 py-2 rounded-lg hover:bg-slate-50"
          title="إرجاع للانتظار"
        >
          ↩
        </button>
      </div>
    </div>
  );
}
