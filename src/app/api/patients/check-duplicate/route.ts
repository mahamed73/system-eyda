import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";

/**
 * GET /api/patients/check-duplicate?phone=&name=
 * بيفحص لو فيه مريض موجود بنفس رقم التليفون أو اسم قريب جدًا،
 * عشان ننبه السكرتارية قبل ما تسجّل مريض مكرر.
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const phone = (searchParams.get("phone") ?? "").trim();
  const name = (searchParams.get("name") ?? "").trim();
  const exclude = (searchParams.get("exclude") ?? "").trim();

  if (!phone && !name) {
    return NextResponse.json({ data: { exact_phone: [], similar_name: [] } });
  }

  // مطابقة رقم التليفون (بتجاهل المسافات والشرطات)
  let exactPhone: { id: string; full_name: string; phone: string }[] = [];
  if (phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    if (cleanPhone.length >= 3) {
      const excludeSql = exclude ? " AND id <> $3" : "";
      const params: unknown[] = [clinicId, cleanPhone];
      if (exclude) params.push(exclude);
      const res = await query<{ id: string; full_name: string; phone: string }>(
        `SELECT id, full_name, phone FROM patients
         WHERE clinic_id = $1 AND regexp_replace(phone, '[^0-9]', '', 'g') = $2${excludeSql}`,
        params
      );
      exactPhone = res.rows;
    }
  }

  // تشابه الاسم (Trigram similarity من امتداد pg_trgm)
  let similarName: { id: string; full_name: string; phone: string; similarity: number }[] = [];
  if (name && name.length >= 3) {
    const excludeSql = exclude ? " AND id <> $3" : "";
    const params: unknown[] = [clinicId, name];
    if (exclude) params.push(exclude);
    const res = await query<{ id: string; full_name: string; phone: string; similarity: number }>(
      `SELECT id, full_name, phone,
              similarity(full_name, $2) AS similarity
       FROM patients
       WHERE clinic_id = $1 AND similarity(full_name, $2) > 0.5${excludeSql}
       ORDER BY similarity DESC
       LIMIT 5`,
      params
    );
    similarName = res.rows.map((r) => ({ ...r, similarity: Number(r.similarity) }));
  }

  return NextResponse.json({ data: { exact_phone: exactPhone, similar_name: similarName } });
}
