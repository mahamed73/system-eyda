import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getSummaryReport, type ReportPeriod } from "@/lib/reports/queries";

const VALID_PERIODS: ReportPeriod[] = ["daily", "weekly", "monthly"];

/**
 * GET /api/reports/summary?period=daily|weekly|monthly&from=&to=
 * ملخّص إيرادات/مصروفات/صافي ربح مجمّع حسب الفترة المطلوبة.
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get("period") ?? "daily";

  if (!VALID_PERIODS.includes(periodParam as ReportPeriod)) {
    return NextResponse.json(
      { error: "period لازم يكون daily أو weekly أو monthly" },
      { status: 400 }
    );
  }

  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const report = await getSummaryReport({
    clinicId,
    period: periodParam as ReportPeriod,
    from,
    to,
  });

  return NextResponse.json({ data: report });
}
