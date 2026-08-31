"use client";

import Link from "next/link";
import type { DashboardSummary } from "@/lib/dashboard/queries";
import { AlertIcon, CalendarIcon, ExpensesIcon, PatientsIcon } from "@/components/icons";
import useCountUp from "@/components/use-count-up";
import Sparkline from "@/components/sparkline";
import DonutChart from "@/components/donut-chart";
import WhatsAppTemplates from "@/components/whatsapp-templates";

const statusLabels: Record<string, string> = {
  booked: "محجوز",
  arrived: "حضر",
  completed: "تم الكشف",
  no_show: "لم يحضر",
  cancelled: "ملغي",
};

const activityIcons: Record<string, string> = {
  patient: "🧑‍⚕️",
  visit: "📋",
  payment: "💵",
};

const visitTypeLabels: Record<string, string> = {
  checkup: "كشف",
  follow_up: "متابعة",
  walk_in: "كشف مباشر",
};

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function formatRelativeDay(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("ar-EG-u-nu-latn", { weekday: "short" });
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}

function buildWeekSeries(trend: { date: string; total: number }[]) {
  const map = new Map(trend.map((d) => [d.date, d.total]));
  const series: { date: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    series.push({ date: key, total: map.get(key) ?? 0 });
  }
  return series;
}

// عدّاد متحرك يعرض الرقم بصيغة منسّقة
function AnimatedNumber({ value }: { value: number }) {
  const animated = useCountUp(value);
  return <>{formatMoney(animated)}</>;
}

const donutColors: Record<string, string> = {
  checkup: "#0ea5e9",
  follow_up: "#8b5cf6",
  walk_in: "#94a3b8",
};

export default function DashboardClient({
  summary,
  role,
  userName,
}: {
  summary: DashboardSummary;
  role?: string;
  userName?: string;
}) {
  const isDoctor = role === "doctor";
  const net = summary.revenue.month - summary.expenses.month;
  const weekSeries = buildWeekSeries(summary.revenueTrend);
  const trendValues = weekSeries.map((d) => d.total);
  const hasTrendData = trendValues.some((v) => v > 0);

  const donutSlices = summary.revenueByType.map((r) => ({
    label: visitTypeLabels[r.type] ?? r.type,
    value: r.total,
    color: donutColors[r.type] ?? "#94a3b8",
  }));

  // الطبيب يشوف طابور مرضاه هو بس؛ باقي الأدوار يشوفوا طابور العيادة كله
  const waitingView = isDoctor && summary.doctor
    ? summary.doctor.myQueue
        .filter((m) => m.status === "arrived" || m.status === "in_consultation")
        .map((m) => ({
          id: m.id,
          patient_id: m.patient_id,
          patient_name: m.patient_name,
          patient_phone: "",
          queue_number: m.queue_number,
          status: m.status,
          doctor_name: "",
          arrived_at: m.scheduled_at,
          wait_minutes: m.wait_minutes,
          visit_type: m.visit_type ?? "",
        }))
    : summary.waitingQueue;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* كروت الملخص */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* مواعيد النهاردة — أزرق (طبي) */}
        <Link
          href="/appointments"
          className="group bg-gradient-to-br from-white to-sky-50/60 border border-slate-200 rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-sky-300"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">مواعيد النهاردة</span>
            <span className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-sky-600" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            <AnimatedNumber value={summary.appointmentsToday.total} />
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {summary.appointmentsToday.total === 0
              ? "مفيش مواعيد النهاردة"
              : `${summary.appointmentsToday.completed} تم الكشف — ${
                  summary.appointmentsToday.booked + summary.appointmentsToday.arrived
                } لسه`}
          </p>
        </Link>

        {/* المرضى — أزرق (طبي) */}
        <Link
          href="/patients"
          className="group bg-gradient-to-br from-white to-sky-50/60 border border-slate-200 rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-sky-300"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-500">المرضى</span>
            <span className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center">
              <PatientsIcon className="w-5 h-5 text-sky-600" />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            <AnimatedNumber value={summary.patients.total} />
          </p>
          <p className="text-xs text-emerald-600 mt-1">
            {summary.patients.newToday > 0
              ? `+${summary.patients.newToday} جديد النهاردة`
              : "مفيش مرضى جداد النهاردة"}
          </p>
        </Link>

        {/* إيرادات الشهر — أخضر (مالي) — مخفي عن الطبيب (خاصية إدارية) */}
        {isDoctor && summary.doctor ? (
          <div className="group bg-gradient-to-br from-white to-sky-50/60 border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500">مرضاي النهاردة</span>
              <span className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center">
                <PatientsIcon className="w-5 h-5 text-sky-600" />
              </span>
            </div>
            <p className="text-2xl font-bold text-slate-800">
              <AnimatedNumber value={summary.doctor.myAppointmentsToday} />
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {summary.doctor.myCompletedToday} تم كشفهم
            </p>
          </div>
        ) : (
          <div className="group bg-gradient-to-br from-white to-emerald-50/60 border border-slate-200 rounded-2xl p-5 transition-all hover:shadow-lg hover:-translate-y-0.5 hover:border-emerald-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-slate-500">إيرادات الشهر</span>
              <span className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                <ExpensesIcon className="w-5 h-5 text-emerald-600" />
              </span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <p className="text-2xl font-bold text-emerald-700">
                <AnimatedNumber value={summary.revenue.month} /> ج.م
              </p>
              {hasTrendData && <Sparkline data={trendValues} color="#10b981" />}
            </div>
            {summary.revenue.month === 0 ? (
              <p className="text-xs text-slate-400 mt-1">لسه مفيش إيرادات الشهر ده</p>
            ) : (
              <p className="text-xs text-slate-500 mt-1">
                النهاردة: {formatMoney(summary.revenue.today)} ج.م — صافي الشهر: {formatMoney(net)} ج.م
              </p>
            )}
          </div>
        )}

        {/* تنبيهات المخزون — برتقالي/أحمر */}
        <Link
          href="/inventory"
          className={`group rounded-2xl p-5 border transition-all hover:shadow-lg hover:-translate-y-0.5 ${
            summary.lowStockCount > 0
              ? "bg-gradient-to-br from-red-50 to-orange-50/60 border-red-200 hover:border-red-300"
              : "bg-gradient-to-br from-white to-orange-50/40 border-slate-200 hover:border-orange-300"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-600">تنبيهات المخزون</span>
            <span
              className={`w-9 h-9 rounded-full flex items-center justify-center ${
                summary.lowStockCount > 0 ? "bg-red-100" : "bg-orange-100"
              }`}
            >
              <AlertIcon className={`w-5 h-5 ${summary.lowStockCount > 0 ? "text-red-600" : "text-orange-500"}`} />
            </span>
          </div>
          <p className={`text-2xl font-bold ${summary.lowStockCount > 0 ? "text-red-700" : "text-slate-800"}`}>
            <AnimatedNumber value={summary.lowStockCount} />
          </p>
          <p className={`text-xs mt-1 ${summary.lowStockCount > 0 ? "text-red-600" : "text-orange-600"}`}>
            {summary.lowStockCount > 0 ? "⚠️ صنف تحت الحد الأدنى" : "✓ المخزون في وضع جيد"}
          </p>
        </Link>
      </div>

      {/* 🩺 المريض الحالي (للطبيب) */}
      {isDoctor && summary.doctor?.inConsultation && (
        <div className="bg-gradient-to-l from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1">🩺 المريض الحالي</p>
              <h3 className="text-2xl font-bold text-slate-800">
                {summary.doctor.inConsultation.patient_name}
              </h3>
              <p className="text-sm text-slate-500 mt-1">
                {summary.doctor.inConsultation.age ? `${summary.doctor.inConsultation.age} سنة` : ""}
                {summary.doctor.inConsultation.blood_type ? ` — فصيلة الدم ${summary.doctor.inConsultation.blood_type}` : ""}
              </p>
              {summary.doctor.inConsultation.allergies_notes && (
                <p className="text-sm bg-red-100 text-red-700 rounded-lg px-3 py-2 mt-2 font-medium">
                  ⚠️ {summary.doctor.inConsultation.allergies_notes}
                </p>
              )}
              {summary.doctor.inConsultation.last_diagnosis && (
                <p className="text-sm text-slate-600 mt-3 border-r-2 border-sky-300 pr-3">
                  <span className="text-slate-400">آخر زيارة
                  {summary.doctor.inConsultation.last_visit_date &&
                    ` (${formatRelativeDay(summary.doctor.inConsultation.last_visit_date.slice(0, 10))})`}
                  : </span>
                  {summary.doctor.inConsultation.last_diagnosis}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Link
                href={`/patients/${summary.doctor.inConsultation.patient_id}`}
                className="text-sm bg-white border border-sky-300 text-sky-700 px-4 py-2 rounded-lg hover:bg-sky-50 text-center"
              >
                فتح الملف الطبي
              </Link>
              <Link
                href={`/visits/new?patientId=${summary.doctor.inConsultation.patient_id}&appointmentId=${summary.doctor.inConsultation.appointment_id}`}
                className="text-sm bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-center"
              >
                بدء الزيارة
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* قائمة الانتظار الحية */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
            </span>
            <h3 className="font-semibold text-slate-800">
              {isDoctor ? "مرضاي النهاردة" : "قائمة الانتظار الحية"}
            </h3>
          </div>
          <Link href="/queue" className="text-xs text-sky-600 hover:underline">
            فتح غرفة الانتظار ←
          </Link>
        </div>

        {waitingView.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">
            {isDoctor ? "مفيش مرضى جايين لك النهاردة لسه" : "مفيش مرضى في الانتظار حالياً — القاعة هادية ✅"}
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {waitingView.map((w) => (
              <div
                key={w.id}
                className={`shrink-0 w-56 border rounded-xl p-3 ${
                  w.status === "in_consultation"
                    ? "border-green-300 bg-gradient-to-b from-green-50 to-emerald-50"
                    : "border-slate-200 bg-gradient-to-b from-white to-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm font-black rounded-full px-2.5 py-0.5 ${
                      w.status === "in_consultation"
                        ? "bg-green-600 text-white"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    رقم {w.queue_number ?? "—"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {w.status === "in_consultation" ? "🩺 جوه الكشف" : formatTime(w.arrived_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="font-medium text-slate-800 text-sm">{w.patient_name}</p>
                  <WhatsAppTemplates patientName={w.patient_name} phone={w.patient_phone} />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {visitTypeLabels[w.visit_type] ?? w.visit_type}
                  {isDoctor && w.doctor_name ? "" : ` — ${w.doctor_name}`}
                  {w.wait_minutes != null && w.status === "arrived" ? ` — ${w.wait_minutes} د` : ""}
                </p>
                {w.status === "arrived" && (
                  <Link
                    href={`/visits/new?patientId=${w.patient_id}&appointmentId=${w.id}`}
                    className="mt-2 block text-center text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-3 py-1.5 transition-colors"
                  >
                    بدء الكشف
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* اتجاه الإيرادات + Donut */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="font-semibold text-slate-800 mb-4">اتجاه الإيرادات (آخر 7 أيام)</h3>
          {!hasTrendData ? (
            <p className="text-sm text-slate-400">مفيش إيرادات مسجلة في آخر 7 أيام لسه.</p>
          ) : (
            <div className="flex items-end gap-3 h-40">
              {weekSeries.map((d) => {
                const max = Math.max(1, ...trendValues);
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex items-end justify-center h-32">
                      <div
                        className="w-full max-w-10 bg-gradient-to-t from-sky-500 to-sky-300 rounded-t-md transition-all"
                        style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
                        title={`${d.total} ج.م`}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{formatRelativeDay(d.date)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* توزيع الإيرادات حسب نوع الخدمة */}
          <div className="border-t border-slate-100 mt-5 pt-5 flex items-center gap-6 flex-wrap">
            <DonutChart slices={donutSlices} />
            <div className="space-y-2">
              {donutSlices.length === 0 && (
                <p className="text-sm text-slate-400">مفيش بيانات توزيع لسه.</p>
              )}
              {donutSlices.map((s) => (
                <div key={s.label} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="text-slate-600">{s.label}</span>
                  <span className="font-semibold text-slate-800">{formatMoney(s.value)} ج.م</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* مواعيد النهاردة الجاية */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">مواعيد النهاردة الجاية</h3>
            <Link href="/appointments" className="text-xs text-sky-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          {summary.upcomingAppointments.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-400 mb-3">مفيش مواعيد جاية النهاردة.</p>
              <Link
                href="/appointments/new"
                className="inline-block text-sm bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-4 py-2 transition-colors"
              >
                + حجز موعد جديد
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {summary.upcomingAppointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{a.patient_name}</p>
                    <p className="text-xs text-slate-400">د. {a.doctor_name}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-slate-600 font-medium">{formatTime(a.scheduled_at)}</p>
                    <p className="text-xs text-slate-400">{statusLabels[a.status] ?? a.status}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* توزيع أعمار المرضى */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mt-6">
        <h3 className="font-semibold text-slate-800 mb-4">الفئات العمرية للمرضى</h3>
        {summary.ageDistribution.length === 0 ? (
          <p className="text-sm text-slate-400">مفيش بيانات أعمار مسجلة لسه.</p>
        ) : (
          (() => {
            const maxAge = Math.max(1, ...summary.ageDistribution.map((a) => a.count));
            return (
              <div className="space-y-3">
                {summary.ageDistribution.map((a) => (
                  <div key={a.label} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-40 shrink-0 text-left">{a.label}</span>
                    <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-l from-sky-500 to-sky-300 rounded-md transition-all"
                        style={{ width: `${(a.count / maxAge) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-800 w-8 text-center shrink-0">
                      {a.count}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>

      {/* آخر نشاط */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mt-6">
        <h3 className="font-semibold text-slate-800 mb-4">آخر نشاط في العيادة</h3>
        {summary.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400">مفيش نشاط مسجل لسه.</p>
        ) : (
          <ul className="space-y-3 max-h-64 overflow-y-auto">
            {summary.recentActivity.map((item) => (
              <li key={item.id} className="flex items-center gap-3 text-sm">
                <span className="text-lg">{activityIcons[item.type]}</span>
                <div className="flex-1">
                  <span className="text-slate-800 font-medium">{item.label}</span>
                  <span className="text-slate-500"> — {item.detail}</span>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{timeAgo(item.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
