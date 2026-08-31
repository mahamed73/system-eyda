import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { appointmentUpdateSchema } from "@/lib/appointments/schema";
import { findConflictingAppointment } from "@/lib/appointments/conflict";
import type { Appointment, AppointmentWithNames } from "@/lib/appointments/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SELECT_WITH_NAMES = `
  SELECT a.id, a.clinic_id, a.patient_id, a.doctor_id, a.scheduled_at, a.duration_minutes,
         a.status, a.visit_type, a.price, a.notes, a.created_by, a.created_at,
         p.full_name AS patient_name, p.phone AS patient_phone,
         u.name AS doctor_name
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN users u ON u.id = a.doctor_id
`;

const ACTIVE_STATUSES = new Set(["booked", "arrived", "completed"]);

/**
 * GET /api/appointments/:id
 * تفاصيل موعد واحد (بيُستخدم مثلًا في صفحة تسجيل الكشف عشان يجيب
 * نوع الزيارة والسعر المحدّدين وقت الحجز).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const { rows } = await query<AppointmentWithNames>(
    `${SELECT_WITH_NAMES} WHERE a.id = $1 AND a.clinic_id = $2`,
    [id, clinicId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "الموعد غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ data: rows[0] });
}

/**
 * PATCH /api/appointments/:id
 * تعديل موعد (تغيير حالة، تأجيل، تغيير الطبيب...) مع إعادة فحص تعارض
 * الحجز لو التوقيت/المدة/الطبيب اتغيرت والحالة النهائية "نشطة".
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const parsed = appointmentUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existingResult = await query<Appointment>(
    `SELECT * FROM appointments WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  const existing = existingResult.rows[0];
  if (!existing) {
    return NextResponse.json({ error: "الموعد غير موجود" }, { status: 404 });
  }

  const updates = parsed.data;

  const finalPatientId = updates.patient_id ?? existing.patient_id;
  const finalDoctorId = updates.doctor_id ?? existing.doctor_id;
  const finalScheduledAt = updates.scheduled_at ? new Date(updates.scheduled_at) : new Date(existing.scheduled_at);
  const finalDuration = updates.duration_minutes ?? existing.duration_minutes;
  const finalStatus = updates.status ?? existing.status;

  if (updates.patient_id) {
    const check = await query(`SELECT id FROM patients WHERE id = $1 AND clinic_id = $2`, [
      finalPatientId,
      clinicId,
    ]);
    if (check.rows.length === 0) {
      return NextResponse.json({ error: "المريض غير موجود في هذه العيادة" }, { status: 400 });
    }
  }

  if (updates.doctor_id) {
    const check = await query(
      `SELECT id FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor' AND is_active = true`,
      [finalDoctorId, clinicId]
    );
    if (check.rows.length === 0) {
      return NextResponse.json({ error: "الطبيب غير موجود في هذه العيادة" }, { status: 400 });
    }
  }

  if (ACTIVE_STATUSES.has(finalStatus)) {
    const conflict = await findConflictingAppointment({
      clinicId,
      doctorId: finalDoctorId,
      scheduledAt: finalScheduledAt,
      durationMinutes: finalDuration,
      excludeAppointmentId: id,
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
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  const fieldMap: Record<string, unknown> = {
    patient_id: updates.patient_id,
    doctor_id: updates.doctor_id,
    scheduled_at: updates.scheduled_at ? finalScheduledAt.toISOString() : undefined,
    duration_minutes: updates.duration_minutes,
    status: updates.status,
    visit_type: updates.visit_type,
    price: updates.price,
    notes: updates.notes,
  };

  Object.entries(fieldMap).forEach(([key, value]) => {
    if (value !== undefined) {
      values.push(value);
      setClauses.push(`${key} = $${values.length}`);
    }
  });

  if (setClauses.length === 0) {
    return NextResponse.json({ error: "مفيش بيانات للتعديل" }, { status: 400 });
  }

  values.push(id, clinicId);
  await query(
    `UPDATE appointments SET ${setClauses.join(", ")} WHERE id = $${values.length - 1} AND clinic_id = $${values.length}`,
    values
  );

  const updated = await query<AppointmentWithNames>(`${SELECT_WITH_NAMES} WHERE a.id = $1`, [id]);

  return NextResponse.json({ data: updated.rows[0] });
}

/**
 * DELETE /api/appointments/:id
 * حذف موعد نهائيًا (مثلًا لو اتحجز غلط). لإلغاء موعد فعلي، الأفضل PATCH
 * بتغيير status إلى "cancelled" عشان يفضل في السجل.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const { rows } = await query(
    `DELETE FROM appointments WHERE id = $1 AND clinic_id = $2 RETURNING id`,
    [id, clinicId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "الموعد غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
