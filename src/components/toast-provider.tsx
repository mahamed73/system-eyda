"use client";

import { useEffect, useState } from "react";

interface ToastItem {
  id: number;
  message: string;
  type: "info" | "success" | "warn" | "error";
}

type ToastEventDetail = { message: string; type?: ToastItem["type"] };

let toastId = 0;

/** يعرض toast خفيف أسفل الشاشة — تقدر تناديه من أي مكان في الكود */
export function showToast(message: string, type: ToastItem["type"] = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastEventDetail>("clinic-toast", { detail: { message, type } }));
}

const typeStyles: Record<ToastItem["type"], string> = {
  info: "bg-sky-700",
  success: "bg-emerald-600",
  warn: "bg-amber-600",
  error: "bg-red-600",
};

export default function ToastProvider() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastEventDetail>).detail;
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message: detail.message, type: detail.type ?? "info" }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    }
    window.addEventListener("clinic-toast", onToast);
    return () => window.removeEventListener("clinic-toast", onToast);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-[60] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${typeStyles[t.type]} text-white text-sm font-medium rounded-xl px-4 py-3 shadow-lg flex items-center gap-2 max-w-sm animate-toast-in`}
        >
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
