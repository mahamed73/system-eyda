import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { appointmentInputSchema } from "@/lib/appointments/schema";
import { findConflictingAppointment } from "@/lib/appointments/conflict";
import type { AppointmentWithNames } from "@/lib/appointments/types";

const SELECT_WITH_NAMES = `
  SELECT a.id, a.clinic_id, a.patient_id, a.doctor_id, a.scheduled_at, a.duration_minutes,
         a.status, a.visit_type, a.price, a.notes, a.created_by, a.created_at,
         p.full_name AS patient_name, p.phone AS patient_phone,
         u.name AS doctor_name
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN users u ON u.id = a.doctor_id
`;

/**
 * GET /api/appointments?date=YYYY-MM-DD
 * أو GET /api/appointments?from=YYYY-MM-DD&to=YYYY-MM-DD (للعرض الأسبوعي)
 * افتراضيًا: مواعيد اليوم الحالي فقط. كل شيء متفلتر بـ clinic_id.
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");
  const doctorId = searchParams.get("doctor_id");

  let rangeStart: string;
  let rangeEndExclusive: string;

  if (from && to) {
    rangeStart = `${from}T00:00:00`;
    rangeEndExclusive = `${to}T23:59:59.999`;
  } else {
    const day = date ?? new Date().toISOString().slice(0, 10);
    rangeStart = `${day}T00:00:00`;
    rangeEndExclusive = `${day}T23:59:59.999`;
  }

  const whereClauses = ["a.clinic_id = $1", "a.scheduled_at BETWEEN $2 AND $3"];
  const params: unknown[] = [clinicId, rangeStart, rangeEndExclusive];
  if (status) {
    params.push(status);
    whereClauses.push(`a.status = $${params.length}`);
  }
  if (doctorId) {
    params.push(doctorId);
    whereClauses.push(`a.doctor_id = $${params.length}`);
  }

  const { rows } = await query<AppointmentWithNames>(
    `${SELECT_WITH_NAMES}
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY a.scheduled_at ASC`,
    params
  );

  return NextResponse.json({ data: rows });
}

/**
 * POST /api/appointments
 * إنشاء موعد جديد مع التحقق من:
 *  - إن المريض والطبيب تبع نفس العيادة
 *  - عدم وجود تعارض حجز (Double booking) لنفس الطبيب
 */
export async function POST(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId, id: userId } = sessionOrError;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const parsed = appointmentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { patient_id, doctor_id, scheduled_at, duration_minutes, visit_type, price, notes, patient_has_chronic_disease } =
    parsed.data;

  const patientCheck = await query(
    `SELECT id FROM patients WHERE id = $1 AND clinic_id = $2`,
    [patient_id, clinicId]
  );
  if (patientCheck.rows.length === 0) {
    return NextResponse.json({ error: "المريض غير موجود في هذه العيادة" }, { status: 400 });
  }

  const doctorCheck = await query(
    `SELECT id FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor' AND is_active = true`,
    [doctor_id, clinicId]
  );
  if (doctorCheck.rows.length === 0) {
    return NextResponse.json({ error: "الطبيب غير موجود في هذه العيادة" }, { status: 400 });
  }

  const scheduledAtDate = new Date(scheduled_at);

  const conflict = await findConflictingAppointment({
    clinicId,
    doctorId: doctor_id,
    scheduledAt: scheduledAtDate,
    durationMinutes: duration_minutes,
  });

  if (conflict) {
    return NextResponse.json(
      {
        error: `يوجد تعارض في الحجز — الطبيب لديه موعد آخر (${conflict.patient_name}) في نفس التوقيت`,
        conflict,
      },
      { status: 409 }
    );
  }

  // لو اتبعت إجابة سؤال "هل لدى المريض مرض مزمن؟" وقت الحجز، بنحدّث
  // ملف المريض نفسه بيها (الحقل ده خاصية دايمة للمريض مش للموعد).
  if (patient_has_chronic_disease !== undefined) {
    await query(`UPDATE patients SET has_chronic_disease = $1 WHERE id = $2 AND clinic_id = $3`, [
      patient_has_chronic_disease,
      patient_id,
      clinicId,
    ]);
  }

  const { rows } = await query(
    `INSERT INTO appointments (clinic_id, patient_id, doctor_id, scheduled_at, duration_minutes, visit_type, price, notes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      clinicId,
      patient_id,
      doctor_id,
      scheduledAtDate.toISOString(),
      duration_minutes,
      visit_type,
      price ?? null,
      notes ?? null,
      userId,
    ]
  );

  const createdId = rows[0].id;
  const created = await query<AppointmentWithNames>(
    `${SELECT_WITH_NAMES} WHERE a.id = $1`,
    [createdId]
  );

  return NextResponse.json({ data: created.rows[0] }, { status: 201 });
}
