"use client";

import { useEffect } from "react";

/**
 * تسجيل الـ Service Worker (public/sw.js) لتفعيل وضع Offline
 * لتطبيق الويب (PWA-lite): آخر بيانات محمّلة تفضل متاحة لو النت قطع.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    // نسجّل في المسار العام فقط؛ مسارات المرضى المحميين بتخدم من نفس الأصل.
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // التسجيل مش حرج — التطبيق يشتغل عادي من غيره.
    });
  }, []);

  return null;
}
