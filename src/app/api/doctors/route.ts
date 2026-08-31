import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

interface DoctorRow {
  id: string;
  name: string;
}

/**
 * GET /api/doctors
 * قائمة أطباء العيادة الحالية (لاستخدامها في فورم حجز الموعد).
 */
export async function GET() {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { rows } = await query<DoctorRow>(
    `SELECT id, name FROM users
     WHERE clinic_id = $1 AND role = 'doctor' AND is_active = true
     ORDER BY name ASC`,
    [clinicId]
  );

  return NextResponse.json({ data: rows });
}
