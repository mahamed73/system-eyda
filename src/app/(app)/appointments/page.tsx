"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AppointmentWithNames, AppointmentStatus, VisitType } from "@/lib/appointments/types";
import WhatsAppTemplates from "@/components/whatsapp-templates";

const statusLabels: Record<AppointmentStatus, string> = {
  booked: "محجوز",
  arrived: "حضر",
  completed: "تم الكشف",
  no_show: "لم يحضر",
  cancelled: "ملغي",
};

const statusColors: Record<AppointmentStatus, string> = {
  booked: "bg-sky-50 text-sky-700 border-sky-200",
  arrived: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  no_show: "bg-slate-100 text-slate-500 border-slate-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

const visitTypeLabels: Record<VisitType, string> = {
  checkup: "كشف",
  follow_up: "متابعة",
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Doctor {
  id: string;
  name: string;
}

function AppointmentsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? todayStr();

  const [appointments, setAppointments] = useState<AppointmentWithNames[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  function goToDate(newDate: string) {
    router.push(`/appointments?date=${newDate}`);
  }

  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((json) => setDoctors(json.data ?? []));
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ date });
        if (statusFilter) params.set("status", statusFilter);
        if (doctorFilter) params.set("doctor_id", doctorFilter);
        const res = await fetch(`/api/appointments?${params.toString()}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "تعذّر تحميل المواعيد");
        if (!cancelled) setAppointments(json.data ?? []);
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
  }, [date, statusFilter, doctorFilter]);

  async function updateStatus(id: string, status: AppointmentStatus) {
    setActionError(null);
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) {
      setActionError(json?.error ?? "تعذّر تحديث حالة الموعد");
      return;
    }
    setAppointments((prev) => prev.map((a) => (a.id === id ? json.data : a)));
  }

  async function deleteAppointment(id: string) {
    if (!confirm("متأكد إنك عايز تحذف الموعد ده نهائيًا؟")) return;
    setActionError(null);
    const res = await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setActionError(json?.error ?? "تعذّر حذف الموعد");
      return;
    }
    setAppointments((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-bold text-slate-800 text-lg">المواعيد</h1>
        <Link
          href={`/appointments/new?date=${date}`}
          className="bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          + حجز موعد جديد
        </Link>
      </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
          >
            <option value="">الحالة: الكل</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={doctorFilter}
            onChange={(e) => setDoctorFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700"
          >
            <option value="">الطبيب: الكل</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between mb-6 bg-white border border-slate-200 rounded-xl px-4 py-3">
          <button
            onClick={() => goToDate(addDays(date, 1))}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
          >
            التالي ←
          </button>

          <div className="text-center">
            <p className="font-semibold text-slate-800">{formatDayLabel(date)}</p>
            <div className="flex items-center gap-2 mt-1 justify-center">
              <input
                type="date"
                value={date}
                onChange={(e) => goToDate(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2 py-1"
              />
              {date !== todayStr() && (
                <button
                  onClick={() => goToDate(todayStr())}
                  className="text-xs text-sky-600 hover:underline"
                >
                  النهاردة
                </button>
              )}
            </div>
          </div>

          <button
            onClick={() => goToDate(addDays(date, -1))}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm hover:bg-slate-50"
          >
            → السابق
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}
        {actionError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
            {actionError}
          </p>
        )}

        <div className="space-y-3">
          {loading && <p className="text-slate-400 text-sm text-center py-8">جاري التحميل...</p>}

          {!loading && appointments.length === 0 && (
            <p className="text-slate-400 text-sm text-center py-8 bg-white border border-slate-200 rounded-xl">
              مفيش مواعيد في اليوم ده.
            </p>
          )}

          {!loading &&
            appointments.map((a) => (
              <div
                key={a.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-4"
              >
                <div className="text-center min-w-[64px]">
                  <p className="font-bold text-slate-800">{formatTime(a.scheduled_at)}</p>
                  <p className="text-xs text-slate-400">{a.duration_minutes} د</p>
                </div>

                <div className="flex-1 min-w-[160px]">
                  <Link href={`/patients/${a.patient_id}`} className="font-medium text-slate-800 hover:underline">
                    {a.patient_name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500" dir="ltr">
                      {a.patient_phone}
                    </p>
                    <WhatsAppTemplates patientName={a.patient_name} phone={a.patient_phone} />
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    د. {a.doctor_name} — {visitTypeLabels[a.visit_type]}
                    {a.price != null ? ` — ${a.price} ج.م` : ""}
                  </p>
                  {a.notes && <p className="text-xs text-slate-500 mt-1">📝 {a.notes}</p>}
                </div>

                <span
                  className={`text-xs font-medium rounded-full px-2.5 py-1 border ${statusColors[a.status]}`}
                >
                  {statusLabels[a.status]}
                </span>

                <div className="flex flex-wrap gap-1.5">
                  <Link
                    href={`/encounter/${a.patient_id}`}
                    className="text-xs border border-sky-300 text-sky-700 rounded-lg px-2 py-1 hover:bg-sky-50"
                  >
                    🩺 وضع الكشف
                  </Link>
                  {a.status !== "arrived" && a.status !== "completed" && a.status !== "cancelled" && (
                    <button
                      onClick={() => updateStatus(a.id, "arrived")}
                      className="text-xs border border-amber-300 text-amber-700 rounded-lg px-2 py-1 hover:bg-amber-50"
                    >
                      حضر
                    </button>
                  )}
                  {a.status !== "completed" && a.status !== "cancelled" && (
                    <Link
                      href={`/visits/new?patientId=${a.patient_id}&doctorId=${a.doctor_id}&appointmentId=${a.id}`}
                      className="text-xs border border-emerald-300 text-emerald-700 rounded-lg px-2 py-1 hover:bg-emerald-50"
                    >
                      بدء الكشف
                    </Link>
                  )}
                  {a.status !== "no_show" && a.status !== "completed" && a.status !== "cancelled" && (
                    <button
                      onClick={() => updateStatus(a.id, "no_show")}
                      className="text-xs border border-slate-300 text-slate-600 rounded-lg px-2 py-1 hover:bg-slate-50"
                    >
                      لم يحضر
                    </button>
                  )}
                  {a.status !== "cancelled" && (
                    <button
                      onClick={() => updateStatus(a.id, "cancelled")}
                      className="text-xs border border-red-300 text-red-600 rounded-lg px-2 py-1 hover:bg-red-50"
                    >
                      إلغاء
                    </button>
                  )}
                  <button
                    onClick={() => deleteAppointment(a.id)}
                    className="text-xs border border-slate-200 text-slate-400 rounded-lg px-2 py-1 hover:bg-slate-50"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ))}
        </div>
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={null}>
      <AppointmentsView />
    </Suspense>
  );
}
