import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { visitUpdateSchema } from "@/lib/visits/schema";
import { getVisitWithDetails } from "@/lib/visits/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/visits/:id
 * تفاصيل زيارة واحدة (فيها المدفوعات وإجمالي المتبقي).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const visit = await getVisitWithDetails(id, clinicId);
  if (!visit) {
    return NextResponse.json({ error: "الزيارة غير موجودة" }, { status: 404 });
  }

  return NextResponse.json({ data: visit });
}

/**
 * PATCH /api/visits/:id
 * تعديل التشخيص / الوصفة / السعر (Partial update).
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

  const parsed = visitUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const entries = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return NextResponse.json({ error: "مفيش بيانات للتعديل" }, { status: 400 });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  entries.forEach(([key, value]) => {
    values.push(value);
    setClauses.push(`${key} = $${values.length}`);
  });
  values.push(id, clinicId);

  const result = await query(
    `UPDATE visits SET ${setClauses.join(", ")} WHERE id = $${values.length - 1} AND clinic_id = $${values.length} RETURNING id`,
    values
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "الزيارة غير موجودة" }, { status: 404 });
  }

  const updated = await getVisitWithDetails(id, clinicId);
  return NextResponse.json({ data: updated });
}
