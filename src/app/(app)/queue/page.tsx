import { requireSession } from "@/lib/api-auth";
import { getQueue, cairoToday } from "@/lib/queue/queries";
import { query } from "@/lib/db";
import QueueClient from "./queue-client";

export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const session = await requireSession();
  // requireSession ممكن ترجّع NextResponse لو مفيش جلسة — الـ layout بيحمي الصفحة أصلًا
  if (session instanceof Response) return null;

  const { items, summary } = await getQueue(session.clinicId);

  // مواعيد النهاردة لسه ماحضرتش (عشان زرار "تسجيل حضور")
  const today = cairoToday();
  const bookedToday = await query(
    `SELECT a.id, p.full_name AS patient_name, u.name AS doctor_name,
            a.scheduled_at::text AS scheduled_at, a.visit_type
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = a.doctor_id
     WHERE a.clinic_id = $1 AND a.local_date = $2 AND a.status = 'booked'
     ORDER BY a.scheduled_at ASC`,
    [session.clinicId, today]
  );

  const clinicRes = await query<{ booking_slug: string | null; online_booking_enabled: boolean }>(
    `SELECT booking_slug, online_booking_enabled FROM clinics WHERE id = $1`,
    [session.clinicId]
  );
  const bookingSlug =
    clinicRes.rows[0]?.online_booking_enabled && clinicRes.rows[0]?.booking_slug
      ? clinicRes.rows[0].booking_slug
      : null;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <QueueClient
        initialQueue={JSON.parse(JSON.stringify(items))}
        initialSummary={summary}
        initialBooked={JSON.parse(JSON.stringify(bookedToday.rows))}
        bookingSlug={bookingSlug}
      />
    </div>
  );
}
