import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getEncounterSummary } from "@/lib/encounter/queries";

interface RouteParams {
  params: Promise<{ patientId: string }>;
}

/**
 * GET /api/encounter/:patientId
 * ملخّص "وضع الكشف" لمريض واحد (متفلتر بـ clinic_id).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { patientId } = await params;

  const summary = await getEncounterSummary(clinicId, patientId);
  if (!summary) {
    return NextResponse.json({ error: "المريض غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ data: summary });
}
