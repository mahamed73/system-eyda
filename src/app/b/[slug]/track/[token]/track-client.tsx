"use client";

import { useCallback, useEffect, useState } from "react";

interface BookingData {
  id: string;
  booking_token: string;
  scheduled_at: string;
  status: string;
  visit_type: string;
  price: string;
  queue_number: number | null;
  patient_name: string;
  clinic_name: string;
  clinic_phone: string | null;
  clinic_address: string | null;
}

const STATUS_INFO: Record<string, { label: string; color: string; emoji: string }> = {
  booked: { label: "تم الحجز — في انتظار حضورك", color: "bg-sky-50 text-sky-700 border-sky-200", emoji: "📅" },
  arrived: { label: "حضرتك مسجّل — استنى نداء دورك", color: "bg-amber-50 text-amber-700 border-amber-200", emoji: "🪑" },
  in_consultation: { label: "دورك دلوقتي — ادخل للطبيب", color: "bg-green-50 text-green-700 border-green-200", emoji: "🩺" },
  completed: { label: "تم الكشف — شكرًا لزيارتك", color: "bg-slate-50 text-slate-600 border-slate-200", emoji: "✅" },
  no_show: { label: "لم يتم الحضور", color: "bg-red-50 text-red-700 border-red-200", emoji: "⚠️" },
  cancelled: { label: "الحجز ملغي", color: "bg-red-50 text-red-700 border-red-200", emoji: "❌" },
};

export default function TrackClient({
  token,
  initial,
}: {
  token: string;
  initial: BookingData;
}) {
  const [booking, setBooking] = useState<BookingData>(initial);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/public/booking/${token}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setBooking(json.data);
      }
    } catch {
      // وضع offline: نعرض آخر بيانات معروفة
    }
  }, [token]);

  useEffect(() => {
    const i = setInterval(load, 20000);
    return () => clearInterval(i);
  }, [load]);

  const info = STATUS_INFO[booking.status] ?? STATUS_INFO.booked;
  const dt = new Date(booking.scheduled_at);
  const dateStr = dt.toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = dt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });

  return (
    <div dir="rtl" className="min-h-screen bg-sky-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-sky-100 p-8 max-w-md w-full">
        <p className="text-center text-sm text-slate-400 mb-1">{booking.clinic_name}</p>
        <h1 className="text-xl font-bold text-slate-800 text-center mb-6">حالة الحجز</h1>

        {booking.status === "arrived" && booking.queue_number && (
          <div className="text-center mb-6">
            <p className="text-sm text-slate-500 mb-1">رقم دورك</p>
            <p className="text-6xl font-black text-sky-600">{booking.queue_number}</p>
            <p className="text-sm text-slate-500 mt-1">استنى لحد ما ينادوا على رقمك</p>
          </div>
        )}

        {booking.status === "in_consultation" && (
          <div className="text-center mb-6 bg-green-50 rounded-xl p-5">
            <p className="text-4xl mb-2">🩺</p>
            <p className="text-xl font-bold text-green-700">دورك دلوقتي!</p>
            <p className="text-sm text-green-600 mt-1">اتفضل ادخل للعيادة</p>
          </div>
        )}

        <div className={`rounded-xl border p-4 text-center mb-5 ${info.color}`}>
          <p className="text-2xl mb-1">{info.emoji}</p>
          <p className="font-semibold">{info.label}</p>
        </div>

        <div className="space-y-2 text-sm">
          <Row label="المريض" value={booking.patient_name} />
          <Row label="اليوم" value={dateStr} />
          <Row label="الميعاد" value={timeStr} />
          <Row label="نوع الزيارة" value={booking.visit_type === "follow_up" ? "متابعة" : "كشف"} />
          <Row label="السعر" value={`${booking.price} ج.م`} />
        </div>

        {booking.clinic_phone && (
          <p className="text-center text-xs text-slate-400 mt-6">
            لأي استفسار كلّم العيادة: <span dir="ltr">{booking.clinic_phone}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-slate-50 pb-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}
