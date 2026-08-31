import { query } from "@/lib/db";

export interface ConflictingAppointment {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  patient_name: string;
}

/**
 * بيتحقق من وجود تعارض حجز (Double booking) لنفس الطبيب داخل نفس العيادة.
 * الشرط: أي موعد قائم (مش ملغي/لم يحضر) بيتقاطع زمنيًا مع الفترة الجديدة.
 * تقاطع فترتين [start1,end1) و [start2,end2) بيتحقق لو start1 < end2 AND start2 < end1.
 *
 * excludeAppointmentId بيتستخدم عند تعديل/تأجيل موعد موجود، عشان الموعد
 * نفسه ميتحسبش تعارض مع نفسه.
 */
export async function findConflictingAppointment(params: {
  clinicId: string;
  doctorId: string;
  scheduledAt: Date;
  durationMinutes: number;
  excludeAppointmentId?: string;
}): Promise<ConflictingAppointment | null> {
  const { clinicId, doctorId, scheduledAt, durationMinutes, excludeAppointmentId } = params;

  const newStart = scheduledAt;
  const newEnd = new Date(scheduledAt.getTime() + durationMinutes * 60_000);

  const values: unknown[] = [clinicId, doctorId, newEnd.toISOString(), newStart.toISOString()];
  let excludeClause = "";
  if (excludeAppointmentId) {
    values.push(excludeAppointmentId);
    excludeClause = `AND a.id <> $${values.length}`;
  }

  const { rows } = await query<ConflictingAppointment & { patient_id: string }>(
    `SELECT a.id, a.scheduled_at, a.duration_minutes, p.full_name AS patient_name
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     WHERE a.clinic_id = $1
       AND a.doctor_id = $2
       AND a.status NOT IN ('cancelled', 'no_show')
       AND a.scheduled_at < $3
       AND (a.scheduled_at + (a.duration_minutes || ' minutes')::interval) > $4
       ${excludeClause}
     LIMIT 1`,
    values
  );

  return rows[0] ?? null;
}
