import { query } from "@/lib/db";

export interface EncounterPatient {
  id: string;
  full_name: string;
  phone: string;
  age: number | null;
  gender: string | null;
  allergies_notes: string | null;
  has_chronic_disease: boolean | null;
}

export interface EncounterLastVisit {
  visit_date: string;
  diagnosis: string | null;
  prescription: string | null;
  doctor_name: string;
  price: string;
}

export interface EncounterAppointment {
  scheduled_at: string;
  status: string;
  visit_type: string;
}

export interface EncounterSummary {
  patient: EncounterPatient;
  last_visit: EncounterLastVisit | null;
  upcoming_appointments: EncounterAppointment[];
  visits_count: number;
}

/**
 * ملخّص "وضع الكشف" — البيانات المهمة بس اللي الدكتور محتاجها
 * وهو قاعد قدام المريض: بياناته، الحساسية/المرض المزمن، آخر زيارة،
 * والمواعيد القادمة. من غير تفاصيل زيادة.
 */
export async function getEncounterSummary(
  clinicId: string,
  patientId: string
): Promise<EncounterSummary | null> {
  const patientRes = await query<EncounterPatient>(
    `SELECT id, full_name, phone, age, gender, allergies_notes, has_chronic_disease
     FROM patients
     WHERE id = $1 AND clinic_id = $2`,
    [patientId, clinicId]
  );
  const patient = patientRes.rows[0];
  if (!patient) return null;

  const lastVisitRes = await query<EncounterLastVisit>(
    `SELECT v.visit_date::text AS visit_date, v.diagnosis, v.prescription,
            v.price::text AS price, u.name AS doctor_name
     FROM visits v
     JOIN users u ON u.id = v.doctor_id
     WHERE v.patient_id = $1 AND v.clinic_id = $2
     ORDER BY v.visit_date DESC
     LIMIT 1`,
    [patientId, clinicId]
  );

  const upcomingRes = await query<EncounterAppointment>(
    `SELECT a.scheduled_at::text AS scheduled_at, a.status, a.visit_type
     FROM appointments a
     WHERE a.patient_id = $1 AND a.clinic_id = $2
       AND a.status IN ('booked', 'arrived')
       AND a.scheduled_at >= now()
     ORDER BY a.scheduled_at ASC
     LIMIT 5`,
    [patientId, clinicId]
  );

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM visits
     WHERE patient_id = $1 AND clinic_id = $2`,
    [patientId, clinicId]
  );

  return {
    patient,
    last_visit: lastVisitRes.rows[0] ?? null,
    upcoming_appointments: upcomingRes.rows,
    visits_count: Number(countRes.rows[0]?.count ?? 0),
  };
}
