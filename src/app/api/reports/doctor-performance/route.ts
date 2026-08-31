import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";

/**
 * GET /api/reports/doctor-performance?from=YYYY-MM-DD&to=YYYY-MM-DD
 * أداء الأطباء في الفترة:
 *  - عدد المرضى الفريدين
 *  - عدد الزيارات المكتملة
 *  - الإيرادات المحصّلة فعليًا (مدفوعات الزيارات)
 *  - متوسط قيمة الزيارة
 *  - معدل الإلغاء (ملغي / إجمالي المواعيد)
 * افتراضيًا: آخر 30 يوم.
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") ?? new Date().toISOString().slice(0, 10);
  const from =
    searchParams.get("from") ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { rows } = await query(
    `WITH period AS (
       SELECT $2::date AS d_from, $3::date AS d_to
     )
     SELECT u.id AS doctor_id, u.name AS doctor_name,
       -- زيارات + إيراد
       COALESCE((
         SELECT COUNT(*) FROM visits v WHERE v.doctor_id = u.id
           AND v.clinic_id = $1 AND v.visit_date::date BETWEEN (SELECT d_from FROM period) AND (SELECT d_to FROM period)
       ), 0)::int AS visits_count,
       COALESCE((
         SELECT COUNT(DISTINCT v.patient_id) FROM visits v WHERE v.doctor_id = u.id
           AND v.clinic_id = $1 AND v.visit_date::date BETWEEN (SELECT d_from FROM period) AND (SELECT d_to FROM period)
       ), 0)::int AS unique_patients,
       COALESCE((
         SELECT SUM(p.amount) FROM payments p
         JOIN visits v ON v.id = p.visit_id
         WHERE v.doctor_id = u.id AND v.clinic_id = $1
           AND p.paid_at::date BETWEEN (SELECT d_from FROM period) AND (SELECT d_to FROM period)
       ), 0)::float8 AS revenue,
       -- مواعيد
       COALESCE((
         SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = u.id
           AND a.clinic_id = $1 AND a.local_date BETWEEN (SELECT d_from FROM period) AND (SELECT d_to FROM period)
       ), 0)::int AS appointments_total,
       COALESCE((
         SELECT COUNT(*) FROM appointments a WHERE a.doctor_id = u.id
           AND a.clinic_id = $1 AND a.local_date BETWEEN (SELECT d_from FROM period) AND (SELECT d_to FROM period)
           AND a.status = 'cancelled'
       ), 0)::int AS cancelled_count
     FROM users u
     WHERE u.clinic_id = $1 AND u.role = 'doctor' AND u.is_active = true
     ORDER BY revenue DESC`,
    [clinicId, from, to]
  );

  const data = rows.map((r) => {
    const visits = Number(r.visits_count);
    const revenue = Number(r.revenue);
    const total = Number(r.appointments_total);
    const cancelled = Number(r.cancelled_count);
    return {
      doctor_id: r.doctor_id,
      doctor_name: r.doctor_name,
      visits_count: visits,
      unique_patients: Number(r.unique_patients),
      revenue: Math.round(revenue * 100) / 100,
      avg_visit_value: visits > 0 ? Math.round((revenue / visits) * 100) / 100 : 0,
      appointments_total: total,
      cancelled_count: cancelled,
      cancellation_rate: total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0,
    };
  });

  return NextResponse.json({ data, period: { from, to } });
}
