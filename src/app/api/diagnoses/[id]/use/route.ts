import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/diagnoses/:id/use
 * يزوّد عدّاد استخدام تشخيص جاهز (لما الطبيب يختاره في الكشف).
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  await query(
    `UPDATE diagnosis_library SET usage_count = usage_count + 1
     WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );
  return NextResponse.json({ data: { ok: true } });
}
