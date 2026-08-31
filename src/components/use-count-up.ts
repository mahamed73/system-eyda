"use client";

import { useEffect, useRef, useState } from "react";

/** عدّاد متحرك: بيعد من صفر للرقم الفعلي أول ما يظهر في الشاشة */
export default function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easing خفيف عشان الحركة تبقى ناعمة
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
