"use client";

import { useEffect, useState } from "react";
import type { Patient } from "@/lib/patients/types";

interface PatientPickerProps {
  value: Patient | null;
  onChange: (patient: Patient | null) => void;
}

export default function PatientPicker({ value, onChange }: PatientPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim() || value) {
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}&pageSize=8`);
        const json = await res.json();
        if (!cancelled) setResults(json.data ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, value]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-300 px-3 py-2 bg-slate-50">
        <div>
          <p className="font-medium text-slate-800">{value.full_name}</p>
          <p className="text-xs text-slate-500" dir="ltr">
            {value.phone}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          className="text-xs text-red-600 hover:underline"
        >
          تغيير
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="ابحث بالاسم أو رقم التليفون..."
        className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
      />
      {open && query.trim() && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-auto">
          {loading && <p className="px-3 py-2 text-sm text-slate-400">جاري البحث...</p>}
          {!loading && results.length === 0 && (
            <p className="px-3 py-2 text-sm text-slate-400">مفيش نتائج</p>
          )}
          {!loading &&
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                }}
                className="w-full text-right px-3 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0"
              >
                <p className="font-medium text-slate-800 text-sm">{p.full_name}</p>
                <p className="text-xs text-slate-500" dir="ltr">
                  {p.phone}
                </p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
