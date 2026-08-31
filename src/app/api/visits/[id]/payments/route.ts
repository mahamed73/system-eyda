import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { paymentInputSchema } from "@/lib/visits/schema";
import { getVisitWithDetails } from "@/lib/visits/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/visits/:id/payments
 * تسجيل دفعة جديدة لزيارة (ممكن كذا دفعة على نفس الزيارة — دفع جزئي).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const visitCheck = await query(`SELECT id FROM visits WHERE id = $1 AND clinic_id = $2`, [
    id,
    clinicId,
  ]);
  if (visitCheck.rows.length === 0) {
    return NextResponse.json({ error: "الزيارة غير موجودة" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const parsed = paymentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  await query(`INSERT INTO payments (visit_id, amount, method) VALUES ($1, $2, $3)`, [
    id,
    parsed.data.amount,
    parsed.data.method,
  ]);

  const updated = await getVisitWithDetails(id, clinicId);
  return NextResponse.json({ data: updated }, { status: 201 });
}
