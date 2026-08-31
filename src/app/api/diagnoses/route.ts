import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";

/**
 * GET /api/diagnoses?q=
 * مكتبة التشخيصات المتكررة للعيادة — مرتبة بالأكثر استخدامًا.
 * دكتور معيّن يشوف تشخيصاته + تشخيصات العيادة العامة (doctor_id NULL).
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId, id: userId, role } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const params: unknown[] = [clinicId];
  let where = "clinic_id = $1 AND is_active = true";
  // الدكتور يشوف تشخيصاته هو + العامة؛ السكرتارية تشوف كل تشخيصات العيادة
  if (role === "doctor") {
    params.push(userId);
    where += ` AND (doctor_id = $${params.length} OR doctor_id IS NULL)`;
  }
  if (q.length >= 2) {
    params.push(`%${q}%`);
    where += ` AND title ILIKE $${params.length}`;
  }

  const { rows } = await query(
    `SELECT id, title, diagnosis, prescription, usage_count, doctor_id
     FROM diagnosis_library
     WHERE ${where}
     ORDER BY usage_count DESC, title ASC
     LIMIT 50`,
    params
  );

  return NextResponse.json({ data: rows });
}

/**
 * POST /api/diagnoses
 * إضافة تشخيص جاهز جديد للمكتبة.
 */
export async function POST(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId, id: userId } = sessionOrError;

  const body = await request.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const diagnosis = String(body?.diagnosis ?? "").trim();
  const prescription = String(body?.prescription ?? "").trim();

  if (title.length < 2) {
    return NextResponse.json({ error: "عنوان التشخيص مطلوب (سطرين على الأقل)" }, { status: 400 });
  }
  if (!diagnosis && !prescription) {
    return NextResponse.json({ error: "اكتب التشخيص أو الروشتة على الأقل" }, { status: 400 });
  }

  const { rows } = await query<{ id: string }>(
    `INSERT INTO diagnosis_library (clinic_id, doctor_id, title, diagnosis, prescription)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [clinicId, userId, title.slice(0, 255), diagnosis || null, prescription || null]
  );

  return NextResponse.json({ data: { id: rows[0].id } }, { status: 201 });
}
