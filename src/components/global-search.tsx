"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchIcon } from "./icons";
import WhatsAppTemplates from "./whatsapp-templates";

interface SearchPatient {
  id: string;
  full_name: string;
  phone: string;
  has_chronic_disease: boolean | null;
  allergies_notes: string | null;
}

interface SearchAppointment {
  id: string;
  scheduled_at: string;
  status: string;
  visit_type: string;
  price: string | null;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
}

interface SearchVisit {
  id: string;
  visit_date: string;
  diagnosis: string | null;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
}

interface SearchResults {
  patients: SearchPatient[];
  appointments: SearchAppointment[];
  visits: SearchVisit[];
}

const visitTypeLabels: Record<string, string> = {
  checkup: "كشف",
  follow_up: "متابعة",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function appointmentDate(scheduledAt: string) {
  const d = new Date(scheduledAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function GlobalSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults>({ patients: [], appointments: [], visits: [] });
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(value: string) {
    setQ(value);
    setOpen(true);
    if (value.trim().length < 2) {
      setResults({ patients: [], appointments: [], visits: [] });
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  // Debounce البحث عشان منبعتش طلب مع كل حرف
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`);
        const json = await res.json();
        if (res.ok) {
          setResults(json.data ?? { patients: [], appointments: [], visits: [] });
        }
      } catch {
        // نتجاهل أخطاء الشبكة المؤقتة
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  // إغلاق القايمة عند الضغط برّه
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function goTo(href: string) {
    setOpen(false);
    setQ("");
    router.push(href);
  }

  const hasResults =
    results.patients.length > 0 || results.appointments.length > 0 || results.visits.length > 0;
  const showDropdown = open && q.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full max-w-md mx-4">
      <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 border border-transparent focus-within:bg-white focus-within:border-sky-300 transition-colors">
        <SearchIcon className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter" && results.patients.length === 1 && results.appointments.length === 0 && results.visits.length === 0) {
              goTo(`/patients/${results.patients[0].id}`);
            }
          }}
          placeholder="بحث سريع بالاسم أو التليفون..."
          className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
        />
        {loading && <span className="text-xs text-slate-400 shrink-0">جاري البحث...</span>}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
          {!loading && !hasResults && (
            <p className="text-sm text-slate-400 px-4 py-6 text-center">
              مفيش نتائج مطابقة لـ «{q.trim()}».
            </p>
          )}

          {results.patients.length > 0 && (
            <div className="py-1">
              <p className="text-xs font-semibold text-slate-400 px-4 pt-2 pb-1">المرضى</p>
              {results.patients.map((p) => (
                <div
                  key={p.id}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer"
                  onClick={() => goTo(`/patients/${p.id}`)}
                >
                  <span className="flex-1 min-w-0 text-right">
                    <span className="block text-sm text-slate-800 truncate">{p.full_name}</span>
                    <span className="block text-xs text-slate-400" dir="ltr">
                      {p.phone}
                    </span>
                  </span>
                  {p.has_chronic_disease && <span className="text-xs shrink-0">⚠️ مرض مزمن</span>}
                  {p.allergies_notes && <span className="text-xs shrink-0">🚫</span>}
                  <WhatsAppTemplates patientName={p.full_name} phone={p.phone} />
                </div>
              ))}
            </div>
          )}

          {results.appointments.length > 0 && (
            <div className="py-1 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 px-4 pt-2 pb-1">المواعيد</p>
              {results.appointments.map((a) => (
                <button
                  key={a.id}
                  onClick={() => goTo(`/appointments?date=${appointmentDate(a.scheduled_at)}`)}
                  className="w-full text-right px-4 py-2 hover:bg-slate-50"
                >
                  <span className="block text-sm text-slate-800 truncate">{a.patient_name}</span>
                  <span className="block text-xs text-slate-500">
                    {formatDate(a.scheduled_at)} — {formatTime(a.scheduled_at)} — د. {a.doctor_name} —{" "}
                    {visitTypeLabels[a.visit_type] ?? a.visit_type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {results.visits.length > 0 && (
            <div className="py-1 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 px-4 pt-2 pb-1">الزيارات / الكشوفات</p>
              {results.visits.map((v) => (
                <button
                  key={v.id}
                  onClick={() => goTo(`/visits/${v.id}`)}
                  className="w-full text-right px-4 py-2 hover:bg-slate-50"
                >
                  <span className="block text-sm text-slate-800 truncate">{v.patient_name}</span>
                  <span className="block text-xs text-slate-500">
                    {formatDate(v.visit_date)} — د. {v.doctor_name}
                    {v.diagnosis ? ` — ${v.diagnosis}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
