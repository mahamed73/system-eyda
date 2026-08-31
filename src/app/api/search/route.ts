import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";

/**
 * GET /api/search?q=...
 * بحث موحّد في كل أقسام النظام (مرضى / مواعيد / زيارات) بالاسم أو رقم التليفون،
 * عشان السكرتارية توصل لأي حاجة بسرعة من الشريط العلوي.
 */

export interface SearchPatient {
  id: string;
  full_name: string;
  phone: string;
  has_chronic_disease: boolean | null;
  allergies_notes: string | null;
}

export interface SearchAppointment {
  id: string;
  scheduled_at: string;
  status: string;
  visit_type: string;
  price: string | null;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
}

export interface SearchVisit {
  id: string;
  visit_date: string;
  diagnosis: string | null;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
}

export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  // أقل من حرفين = مفيش بحث كافي، نرجّع نتائج فاضية بدون استعلام على الداتابيز
  if (q.length < 2) {
    return NextResponse.json({
      data: { patients: [], appointments: [], visits: [], query: q },
    });
  }

  const like = `%${q}%`;

  const [patientsRes, appointmentsRes, visitsRes] = await Promise.all([
    query<SearchPatient>(
      `SELECT id, full_name, phone, has_chronic_disease, allergies_notes
       FROM patients
       WHERE clinic_id = $1 AND (full_name ILIKE $2 OR phone ILIKE $2)
       ORDER BY created_at DESC
       LIMIT 6`,
      [clinicId, like]
    ),
    query<SearchAppointment>(
      `SELECT a.id, a.scheduled_at::text AS scheduled_at, a.status,
              a.visit_type, a.price::text AS price,
              p.full_name AS patient_name, p.phone AS patient_phone,
              u.name AS doctor_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN users u ON u.id = a.doctor_id
       WHERE a.clinic_id = $1 AND (p.full_name ILIKE $2 OR p.phone ILIKE $2)
       ORDER BY a.scheduled_at DESC
       LIMIT 6`,
      [clinicId, like]
    ),
    query<SearchVisit>(
      `SELECT v.id, v.visit_date::text AS visit_date, v.diagnosis,
              p.full_name AS patient_name, p.phone AS patient_phone,
              u.name AS doctor_name
       FROM visits v
       JOIN patients p ON p.id = v.patient_id
       JOIN users u ON u.id = v.doctor_id
       WHERE v.clinic_id = $1
         AND (p.full_name ILIKE $2 OR p.phone ILIKE $2 OR v.diagnosis ILIKE $2)
       ORDER BY v.visit_date DESC
       LIMIT 6`,
      [clinicId, like]
    ),
  ]);

  return NextResponse.json({
    data: {
      patients: patientsRes.rows,
      appointments: appointmentsRes.rows,
      visits: visitsRes.rows,
      query: q,
    },
  });
}
