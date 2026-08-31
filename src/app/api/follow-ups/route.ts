import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";

/**
 * GET /api/follow-ups?filter=due|today|upcoming
 * قائمة المتابعات المعلّقة للعيادة:
 *  - due:      متأخرة (التاريخ فات ولسه متمّتش)
 *  - today:    متابعة النهاردة
 *  - upcoming: الأسبوع الجاي (بكرة لحد +7 أيام)
 * المتابعات اللي المريض عمل بعدها زيارة أحدث بتستثنى تلقائيًا
 * (نفس منطق تنبيهات المتابعة في notifications/queries.ts).
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "due";

  let dateCondition: string;
  if (filter === "today") {
    dateCondition = `v.follow_up_date = CURRENT_DATE`;
  } else if (filter === "upcoming") {
    dateCondition = `v.follow_up_date > CURRENT_DATE AND v.follow_up_date <= CURRENT_DATE + INTERVAL '7 days'`;
  } else {
    dateCondition = `v.follow_up_date < CURRENT_DATE`;
  }

  const { rows } = await query(
    `SELECT v.id AS visit_id, v.follow_up_date::text AS follow_up_date,
            v.diagnosis, p.id AS patient_id, p.full_name AS patient_name,
            p.phone AS patient_phone, u.name AS doctor_name,
            v.follow_up_date - CURRENT_DATE AS days_offset
     FROM visits v
     JOIN patients p ON p.id = v.patient_id
     JOIN users u ON u.id = v.doctor_id
     WHERE v.clinic_id = $1
       AND v.follow_up_date IS NOT NULL
       AND v.follow_up_completed = false
       AND ${dateCondition}
       AND NOT EXISTS (
         SELECT 1 FROM visits v2
         WHERE v2.patient_id = v.patient_id
           AND v2.clinic_id = v.clinic_id
           AND v2.id <> v.id
           AND v2.visit_date::date > v.follow_up_date
       )
     ORDER BY v.follow_up_date ASC
     LIMIT 100`,
    [clinicId]
  );

  return NextResponse.json({ data: rows });
}

/**
 * PATCH /api/follow-ups
 * Body: { visit_id, result?, completed?, new_date? }
 * تسجيل نتيجة المتابعة / إتمامها / إعادة جدولتها لتاريخ تاني.
 */
export async function PATCH(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const body = await request.json().catch(() => null);
  if (!body?.visit_id) {
    return NextResponse.json({ error: "visit_id مطلوب" }, { status: 400 });
  }

  const sets: string[] = [];
  const values: unknown[] = [];

  if (typeof body.result === "string") {
    values.push(body.result.trim().slice(0, 4000) || null);
    sets.push(`follow_up_result = $${values.length}`);
  }
  if (body.completed === true) {
    values.push(true);
    sets.push(`follow_up_completed = $${values.length}`);
    // لو المريض اتتابع فعلًا، نسجّل نتيجة افتراضية لو مفيش
    if (!body.result) {
      values.push("تمت المتابعة باتصال هاتفي — المريض بحالة جيدة");
      sets.push(`follow_up_result = COALESCE(follow_up_result, $${values.length})`);
    }
  }
  if (typeof body.new_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.new_date)) {
    values.push(body.new_date);
    sets.push(`follow_up_date = $${values.length}`);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "مفيش بيانات للتحديث" }, { status: 400 });
  }

  values.push(body.visit_id, clinicId);
  const { rows } = await query(
    `UPDATE visits SET ${sets.join(", ")}
     WHERE id = $${values.length - 1} AND clinic_id = $${values.length}
     RETURNING id`,
    values
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "الزيارة غير موجودة" }, { status: 404 });
  }
  return NextResponse.json({ data: { id: rows[0].id } });
}
