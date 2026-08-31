import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/expenses/:id
 * حذف مصروف (لتصحيح خطأ إدخال). امتداد عملي بسيط فوق التصميم التقني
 * الأصلي (اللي فيه GET/POST بس) لأن أخطاء إدخال المصروفات شائعة عمليًا.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const { rows } = await query(`DELETE FROM expenses WHERE id = $1 AND clinic_id = $2 RETURNING id`, [
    id,
    clinicId,
  ]);

  if (rows.length === 0) {
    return NextResponse.json({ error: "المصروف غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ data: { id } });
}
