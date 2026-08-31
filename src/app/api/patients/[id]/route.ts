import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { patientUpdateSchema } from "@/lib/patients/schema";
import type { Patient } from "@/lib/patients/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PatientVisitSummary {
  id: string;
  visit_date: string;
  diagnosis: string | null;
  prescription: string | null;
  price: string;
  doctor_name: string;
  total_paid: string;
}

/**
 * GET /api/patients/:id
 * تفاصيل مريض واحد (متفلتر بـ clinic_id) + سجل الزيارات (Module 4).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const { rows } = await query<Patient>(
    `SELECT id, clinic_id, full_name, phone, age, gender, address, allergies_notes, has_chronic_disease, blood_type, created_at, updated_at
     FROM patients
     WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );

  const patient = rows[0];
  if (!patient) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }

  const visitsResult = await query<PatientVisitSummary>(
    `SELECT v.id, v.visit_date, v.diagnosis, v.prescription, v.price, u.name AS doctor_name,
            COALESCE((SELECT SUM(amount) FROM payments WHERE visit_id = v.id), 0) AS total_paid
     FROM visits v
     JOIN users u ON u.id = v.doctor_id
     WHERE v.patient_id = $1 AND v.clinic_id = $2
     ORDER BY v.visit_date DESC`,
    [id, clinicId]
  );

  return NextResponse.json({ data: { ...patient, visits: visitsResult.rows } });
}


/**
 * PATCH /api/patients/:id
 * تعديل بيانات مريض (Partial update). متفلتر بـ clinic_id إجباريًا.
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

  const parsed = patientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const fields = parsed.data;
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);

  if (entries.length === 0) {
    return NextResponse.json({ error: "مفيش بيانات للتعديل" }, { status: 400 });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];

  entries.forEach(([key, value], index) => {
    setClauses.push(`${key} = $${index + 1}`);
    values.push(value);
  });

  values.push(id, clinicId);

  const { rows } = await query<Patient>(
    `UPDATE patients
     SET ${setClauses.join(", ")}
     WHERE id = $${values.length - 1} AND clinic_id = $${values.length}
     RETURNING id, clinic_id, full_name, phone, age, gender, address, allergies_notes, has_chronic_disease, blood_type, created_at, updated_at`,
    values
  );

  const patient = rows[0];
  if (!patient) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ data: patient });
}
