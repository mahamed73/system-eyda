import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getQueue } from "@/lib/queue/queries";

/**
 * GET /api/queue?date=YYYY-MM-DD
 * قائمة الدور الكاملة للنهاردة (حضور / جوه الكشف / مكتمل) + ملخص الأعداد.
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;

  const { items, summary } = await getQueue(clinicId, date ?? undefined);
  return NextResponse.json({ data: items, summary });
}
