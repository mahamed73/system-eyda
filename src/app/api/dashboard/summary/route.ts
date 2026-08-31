import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getDashboardSummary } from "@/lib/dashboard/queries";

/**
 * GET /api/dashboard/summary
 * كل الأرقام اللي محتاجينها لعرض لوحة التحكم الرئيسية في طلب واحد.
 */
export async function GET() {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId, id, role } = sessionOrError;

  const summary = await getDashboardSummary(clinicId, { id, role });
  return NextResponse.json({ data: summary });
}
