import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { getClinicNotifications } from "@/lib/notifications/queries";

/**
 * GET /api/notifications
 * كل التنبيهات الذكية للعيادة مرتبة حسب الأولوية (أحمر/برتقالي/أصفر).
 */
export async function GET() {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const notifications = await getClinicNotifications(clinicId);
  return NextResponse.json({ data: notifications });
}
