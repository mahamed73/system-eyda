import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getFullFinancialReport } from "@/lib/reports/queries";

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

/**
 * GET /api/reports/financial?from=&to=
 * التقرير المالي الكامل (إيرادات + مصروفات + يومي) في ردّ واحد،
 * بستخدمه في صفحة الطباعة/PDF وأي تصدير JSON.
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId, clinicName } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const defaults = defaultDateRange();
  const from = searchParams.get("from") ?? defaults.from;
  const to = searchParams.get("to") ?? defaults.to;

  const report = await getFullFinancialReport(clinicId, from, to);
  return NextResponse.json({ data: report, clinicName });
}
