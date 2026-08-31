"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClinicNotification } from "@/lib/notifications/queries";

const priorityStyles: Record<string, { dot: string; badge: string; label: string }> = {
  high: { dot: "bg-red-500", badge: "bg-red-50 border-red-200", label: "عاجل" },
  medium: { dot: "bg-orange-500", badge: "bg-orange-50 border-orange-200", label: "مهم" },
  low: { dot: "bg-yellow-500", badge: "bg-yellow-50 border-yellow-200", label: "عادي" },
};

export default function NotificationsBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<ClinicNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const json = await res.json();
      if (res.ok) setNotifications(json.data ?? []);
    } catch {
      // نتجاهل أخطاء الشبكة
    } finally {
      setLoading(false);
    }
  }

  function goTo(n: ClinicNotification) {
    setOpen(false);
    router.push(n.link);
  }

  const highCount = notifications.filter((n) => n.priority === "high").length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        title="التنبيهات"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
        {highCount > 0 && (
          <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {highCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <p className="text-sm font-semibold text-slate-800 px-4 pt-3 pb-2 border-b border-slate-100">
            التنبيهات
          </p>

          {loading && <p className="text-sm text-slate-400 px-4 py-6 text-center">جاري التحميل...</p>}

          {!loading && notifications.length === 0 && (
            <p className="text-sm text-slate-400 px-4 py-6 text-center">
              مفيش تنبيهات حالياً ✅
            </p>
          )}

          {!loading && (
            <ul className="max-h-[60vh] overflow-y-auto">
              {notifications.map((n) => {
                const s = priorityStyles[n.priority];
                return (
                  <li key={n.id}>
                    <button
                      onClick={() => goTo(n)}
                      className={`w-full text-right flex items-start gap-2.5 px-4 py-2.5 hover:bg-slate-50 border-b border-slate-50`}
                    >
                      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-slate-800">
                          {n.title}
                          <span className={`mr-1.5 text-[10px] rounded-full px-1.5 py-0.5 border ${s.badge}`}>
                            {s.label}
                          </span>
                        </span>
                        <span className="block text-xs text-slate-500 truncate">{n.detail}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
