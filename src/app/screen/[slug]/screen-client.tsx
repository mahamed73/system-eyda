"use client";

import { useCallback, useEffect, useState } from "react";

interface ScreenData {
  clinic_name: string;
  now: { queue_number: number; name: string }[];
  waiting: {
    queue_number: number;
    name: string;
    wait_minutes: number | null;
    priority: number;
    doctor_name: string;
  }[];
  last_done: { queue_number: number; name: string }[];
  waiting_count: number;
}

export default function ScreenClient({
  slug,
  initial,
}: {
  slug: string;
  initial: ScreenData;
}) {
  const [data, setData] = useState<ScreenData>(initial);
  const [now, setNow] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/screen/${slug}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch {
      // offline: نعرض آخر بيانات
    }
    setNow(
      new Date().toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }, [slug]);

  useEffect(() => {
    load();
    const i = setInterval(load, 10000);
    return () => clearInterval(i);
  }, [load]);

  return (
    <div dir="rtl" className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* الهيدر */}
      <header className="bg-sky-700 px-8 py-5 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{data.clinic_name}</h1>
        <div className="text-left">
          <p className="text-sky-100 text-sm">شاشة الانتظار</p>
          <p className="text-2xl font-mono font-bold">{now}</p>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-3 gap-6 p-8 overflow-hidden">
        {/* الكشف الحالي */}
        <section className="col-span-1 flex flex-col">
          <h2 className="text-xl font-bold text-green-400 mb-4">🩺 جوه الكشف دلوقتي</h2>
          <div className="flex-1 flex flex-col gap-4">
            {data.now.length === 0 && (
              <p className="text-slate-500 text-lg">لا يوجد حاليًا</p>
            )}
            {data.now.map((p) => (
              <div key={p.queue_number} className="bg-green-600/20 border-2 border-green-500 rounded-2xl p-6 text-center">
                <p className="text-7xl font-black text-green-400">{p.queue_number}</p>
                <p className="text-2xl mt-2">{p.name}</p>
              </div>
            ))}
          </div>
        </section>

        {/* قائمة الانتظار */}
        <section className="col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-amber-400">🪑 قائمة الانتظار</h2>
            <span className="bg-amber-500/20 text-amber-300 px-4 py-1.5 rounded-full text-lg font-bold">
              {data.waiting_count} منتظر
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <table className="w-full text-right">
              <thead>
                <tr className="text-slate-400 text-sm border-b border-slate-700">
                  <th className="pb-2 pr-2">رقم الدور</th>
                  <th className="pb-2">المريض</th>
                  <th className="pb-2">الطبيب</th>
                  <th className="pb-2 pl-2 text-left">مدة الانتظار</th>
                </tr>
              </thead>
              <tbody>
                {data.waiting.slice(0, 8).map((p) => (
                  <tr
                    key={p.queue_number}
                    className={`border-b border-slate-800 text-xl ${
                      p.priority ? "bg-red-900/30" : ""
                    }`}
                  >
                    <td className="py-3 pr-2">
                      <span className="inline-flex items-center gap-2">
                        <span className="text-3xl font-black text-sky-400 w-14">{p.queue_number}</span>
                        {p.priority === 1 && <span className="text-red-400 text-sm">🚨 طارئ</span>}
                      </span>
                    </td>
                    <td className="py-3 text-2xl font-semibold">{p.name}</td>
                    <td className="py-3 text-slate-300">{p.doctor_name}</td>
                    <td className="py-3 pl-2 text-left text-slate-400">
                      {p.wait_minutes != null ? `${p.wait_minutes} دقيقة` : "—"}
                    </td>
                  </tr>
                ))}
                {data.waiting.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-500 text-xl">
                      القائمة فاضية حاليًا — أهلًا بيكم
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {data.last_done.length > 0 && (
        <footer className="bg-slate-800 px-8 py-3 flex items-center gap-6 text-slate-400">
          <span className="text-sm">آخر المنتهيين:</span>
          {data.last_done.map((p) => (
            <span key={p.queue_number} className="text-lg">
              <span className="font-bold text-slate-200">{p.queue_number}</span> {p.name}
            </span>
          ))}
        </footer>
      )}
    </div>
  );
}
