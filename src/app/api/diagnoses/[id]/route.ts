import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/diagnoses/:id
 * تعديل تشخيص جاهز.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

  const sets: string[] = [];
  const values: unknown[] = [];
  if (typeof body.title === "string" && body.title.trim().length >= 2) {
    values.push(body.title.trim().slice(0, 255));
    sets.push(`title = $${values.length}`);
  }
  if (typeof body.diagnosis === "string") {
    values.push(body.diagnosis.trim() || null);
    sets.push(`diagnosis = $${values.length}`);
  }
  if (typeof body.prescription === "string") {
    values.push(body.prescription.trim() || null);
    sets.push(`prescription = $${values.length}`);
  }
  if (typeof body.is_active === "boolean") {
    values.push(body.is_active);
    sets.push(`is_active = $${values.length}`);
  }
  if (sets.length === 0) {
    return NextResponse.json({ error: "مفيش بيانات للتعديل" }, { status: 400 });
  }

  values.push(id, clinicId);
  const { rows } = await query(
    `UPDATE diagnosis_library SET ${sets.join(", ")}
     WHERE id = $${values.length - 1} AND clinic_id = $${values.length}
     RETURNING id`,
    values
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "التشخيص غير موجود" }, { status: 404 });
  }
  return NextResponse.json({ data: { id } });
}

/**
 * DELETE /api/diagnoses/:id — حذف (أرشفة) تشخيص جاهز.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const { rows } = await query(
    `UPDATE diagnosis_library SET is_active = false
     WHERE id = $1 AND clinic_id = $2 RETURNING id`,
    [id, clinicId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "التشخيص غير موجود" }, { status: 404 });
  }
  return NextResponse.json({ data: { id } });
}
