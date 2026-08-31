import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { findConflictingAppointment } from "@/lib/appointments/conflict";

/**
 * GET /api/appointments/check-conflict?doctor_id=&datetime=&duration=&excludeId=
 * فحص سريع من الواجهة قبل ما المستخدم يضغط "حفظ" — بيرجّع تفاصيل
 * التعارض لو موجود، بدون ما يعمل أي تعديل فعلي.
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctor_id");
  const datetime = searchParams.get("datetime");
  const duration = Number(searchParams.get("duration") ?? "15");
  const excludeId = searchParams.get("excludeId") ?? undefined;

  if (!doctorId || !datetime || Number.isNaN(Date.parse(datetime))) {
    return NextResponse.json({ error: "بيانات غير كافية للفحص" }, { status: 400 });
  }

  const conflict = await findConflictingAppointment({
    clinicId,
    doctorId,
    scheduledAt: new Date(datetime),
    durationMinutes: Number.isFinite(duration) && duration > 0 ? duration : 15,
    excludeAppointmentId: excludeId,
  });

  return NextResponse.json({ hasConflict: !!conflict, conflict });
}
