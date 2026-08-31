import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";

/**
 * GET /api/patients/winback
 * المرضى اللي مجوش العيادة من 6 شهور (أو عمرهم مسجلين ومجوش خالص).
 * بيستخدمهم في حملة "استعادة المرضى الغائبين".
 */
export async function GET() {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { rows } = await query<{
    id: string;
    full_name: string;
    phone: string;
    last_visit_date: string | null;
    months_since: number;
  }>(
    `SELECT p.id, p.full_name, p.phone,
            (SELECT MAX(v.visit_date)::date::text FROM visits v
              WHERE v.patient_id = p.id AND v.clinic_id = p.clinic_id) AS last_visit_date,
            EXTRACT(EPOCH FROM (now() - (
              SELECT MAX(v.visit_date) FROM visits v
              WHERE v.patient_id = p.id AND v.clinic_id = p.clinic_id
            ))) / 2592000 AS months_since
     FROM patients p
     WHERE p.clinic_id = $1
       AND EXISTS (
         SELECT 1 FROM visits v
         WHERE v.patient_id = p.id AND v.clinic_id = p.clinic_id
       )
       AND NOT EXISTS (
         SELECT 1 FROM visits v
         WHERE v.patient_id = p.id AND v.clinic_id = p.clinic_id
           AND v.visit_date >= now() - interval '180 days'
       )
     ORDER BY last_visit_date ASC
     LIMIT 100`,
    [clinicId]
  );

  return NextResponse.json({
    data: rows.map((r) => ({
      ...r,
      months_since: Math.floor(r.months_since),
    })),
  });
}
