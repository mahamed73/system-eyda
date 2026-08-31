import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getQueue } from "@/lib/queue/queries";

/**
 * GET /api/waiting-queue
 * قائمة المرضى الحاضرين اللي لسه مكشفوش (status = 'arrived')
 * بترتيب الدور الذكي — بيستخدمها الـ live poller (toasts الوصول الجديد)
 * وكارت غرفة الانتظار في الداشبورد.
 */
export async function GET() {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { items, summary } = await getQueue(clinicId);
  const waiting = items.filter((i) => i.status === "arrived");

  return NextResponse.json({
    data: waiting,
    // count محتفظين به للـ live-arrivals القديم (عدد المنتظرين)
    count: waiting.length,
    summary,
  });
}
