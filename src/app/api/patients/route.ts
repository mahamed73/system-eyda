import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { patientInputSchema } from "@/lib/patients/schema";
import type { Patient, PatientListItem } from "@/lib/patients/types";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const SELECT_WITH_LAST_VISIT = `
  SELECT p.id, p.clinic_id, p.full_name, p.phone, p.age, p.gender, p.address,
         p.allergies_notes, p.has_chronic_disease, p.blood_type, p.created_at, p.updated_at,
         (SELECT MAX(v.visit_date)::date::text FROM visits v WHERE v.patient_id = p.id AND v.clinic_id = p.clinic_id) AS last_visit_date,
         (NOT EXISTS (
            SELECT 1 FROM visits v
            WHERE v.patient_id = p.id AND v.clinic_id = p.clinic_id
              AND v.visit_date >= now() - interval '90 days'
         )) AS is_inactive
  FROM patients p
`;

/**
 * GET /api/patients?search=&page=&pageSize=&chronic=&has_notes=&gender=&activity=
 * بحث بالاسم أو رقم التليفون + فلاتر (مرض مزمن / ملاحظات / نوع / نشاط) + Pagination.
 * كل النتائج متفلترة بـ clinic_id بتاع العيادة المسجّل دخولها إجباريًا.
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") ?? "").trim();
  const chronic = searchParams.get("chronic");
  const hasNotes = searchParams.get("has_notes");
  const gender = searchParams.get("gender");
  const activity = searchParams.get("activity");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)) || DEFAULT_PAGE_SIZE)
  );
  const offset = (page - 1) * pageSize;

  const whereClauses = ["p.clinic_id = $1"];
  const params: unknown[] = [clinicId];

  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`(p.full_name ILIKE $${params.length} OR p.phone ILIKE $${params.length})`);
  }
  if (chronic === "yes") whereClauses.push("p.has_chronic_disease = TRUE");
  if (chronic === "no") whereClauses.push("(p.has_chronic_disease = FALSE OR p.has_chronic_disease IS NULL)");
  if (hasNotes === "yes") whereClauses.push("p.allergies_notes IS NOT NULL AND p.allergies_notes <> ''");
  if (hasNotes === "no") whereClauses.push("(p.allergies_notes IS NULL OR p.allergies_notes = '')");
  if (gender === "male" || gender === "female") {
    params.push(gender);
    whereClauses.push(`p.gender = $${params.length}`);
  }
  if (activity === "active") {
    whereClauses.push(`EXISTS (SELECT 1 FROM visits v WHERE v.patient_id = p.id AND v.clinic_id = p.clinic_id AND v.visit_date >= now() - interval '90 days')`);
  }
  if (activity === "inactive") {
    whereClauses.push(`NOT EXISTS (SELECT 1 FROM visits v WHERE v.patient_id = p.id AND v.clinic_id = p.clinic_id AND v.visit_date >= now() - interval '90 days')`);
  }

  const whereSql = whereClauses.join(" AND ");

  const countResult = await query<{ count: string }>(
    `SELECT count(*)::text AS count FROM patients p WHERE ${whereSql}`,
    params
  );
  const total = Number(countResult.rows[0]?.count ?? "0");

  params.push(pageSize, offset);
  const { rows } = await query<PatientListItem>(
    `${SELECT_WITH_LAST_VISIT}
     WHERE ${whereSql}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return NextResponse.json({
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

/**
 * POST /api/patients
 * إنشاء مريض جديد للعيادة الحالية.
 */
export async function POST(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const parsed = patientInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { full_name, phone, age, gender, address, allergies_notes, has_chronic_disease, blood_type } = parsed.data;

  const { rows } = await query<Patient>(
    `INSERT INTO patients (clinic_id, full_name, phone, age, gender, address, allergies_notes, has_chronic_disease, blood_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, clinic_id, full_name, phone, age, gender, address, allergies_notes, has_chronic_disease, blood_type, created_at, updated_at`,
    [
      clinicId,
      full_name,
      phone,
      age ?? null,
      gender ?? null,
      address ?? null,
      allergies_notes ?? null,
      has_chronic_disease ?? null,
      blood_type ?? null,
    ]
  );

  return NextResponse.json({ data: rows[0] }, { status: 201 });
}
