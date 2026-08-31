"use client";

import { useCallback, useEffect, useState } from "react";

interface DoctorStats {
  doctor_id: string;
  doctor_name: string;
  visits_count: number;
  unique_patients: number;
  revenue: number;
  avg_visit_value: number;
  appointments_total: number;
  cancelled_count: number;
  cancellation_rate: number;
}

function cairoDate(offsetDays = 0) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86400000));
}

export default function DoctorPerformancePage() {
  const [from, setFrom] = useState(cairoDate(-30));
  const [to, setTo] = useState(cairoDate(0));
  const [data, setData] = useState<DoctorStats[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/doctor-performance?from=${from}&to=${to}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (res.ok) setData(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const fmt = (n: number) => n.toLocaleString("ar-EG", { maximumFractionDigits: 1 });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-1">👨‍⚕️ أداء الأطباء</h1>
      <p className="text-sm text-slate-500 mb-6">عدد المرضى، الإيرادات، متوسط الزيارة، ومعدل الإلغاء.</p>

      <div className="flex flex-wrap items-end gap-3 mb-6 bg-white border border-slate-200 rounded-xl p-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">من</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">إلى</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm py-8 text-center">جاري التحميل...</p>
      ) : data.length === 0 ? (
        <p className="text-slate-400 text-sm py-8 text-center">مفيش بيانات في الفترة دي.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {data.map((d) => (
            <div key={d.doctor_id} className="bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <span className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-sm font-bold">
                  {d.doctor_name.replace("د. ", "").charAt(0)}
                </span>
                {d.doctor_name}
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Metric label="عدد المرضى" value={fmt(d.unique_patients)} />
                <Metric label="الزيارات المكتملة" value={fmt(d.visits_count)} />
                <Metric label="الإيرادات" value={`${fmt(d.revenue)} ج.م`} accent />
                <Metric label="متوسط قيمة الزيارة" value={`${fmt(d.avg_visit_value)} ج.م`} />
                <Metric label="إجمالي المواعيد" value={fmt(d.appointments_total)} />
                <Metric
                  label="معدل الإلغاء"
                  value={`${fmt(d.cancellation_rate)}%`}
                  warn={d.cancellation_rate >= 15}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
  warn,
}: {
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        warn
          ? "bg-red-50"
          : accent
            ? "bg-green-50"
            : "bg-slate-50"
      }`}
    >
      <p className={`text-xl font-black ${warn ? "text-red-600" : accent ? "text-green-700" : "text-slate-800"}`}>
        {value}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
