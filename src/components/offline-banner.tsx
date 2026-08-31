"use client";

import { useEffect, useState } from "react";

/**
 * شريط صغير بيظهر فوق الشاشة لما النت يقطع — بيوضح إن النظام بيكمّل
 * بآخر بيانات محمّلة، وإن أي إجراء على الدور هيتسجّل أول ما النت يرجع.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const setFromNavigator = () => setOffline(!navigator.onLine);
    setFromNavigator();
    window.addEventListener("online", setFromNavigator);
    window.addEventListener("offline", setFromNavigator);
    return () => {
      window.removeEventListener("online", setFromNavigator);
      window.removeEventListener("offline", setFromNavigator);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-amber-500 text-white text-center text-sm font-semibold py-2 px-4 print:hidden">
      📵 النت مقطوع حاليًا — النظام بيعرض آخر بيانات محمّلة، وكل التحديثات هتتسجّل أول ما الاتصال يرجع.
    </div>
  );
}
