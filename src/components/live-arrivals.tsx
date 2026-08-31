"use client";

import { useEffect, useRef } from "react";
import { showToast } from "./toast-provider";

/**
 * بيستمع لحالات الوصول الجديدة: بيعمل poll كل 45 ثانية على قائمة
 * الانتظار، ولو شاف مريض جديد "حضر" بيطلّع toast من غير refresh يدوي.
 */
export default function LiveArrivals() {
  const lastCount = useRef<number | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/waiting-queue");
        if (!res.ok) return;
        const json = await res.json();
        const count: number = json.count ?? 0;
        if (lastCount.current !== null && count > lastCount.current) {
          showToast(`👋 مريض جديد وصل العيادة — قائمة الانتظار ${count}`, "success");
        }
        lastCount.current = count;
      } catch {
        // نتجاهل أخطاء الشبكة
      }
    }

    check();
    const interval = setInterval(check, 45000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
