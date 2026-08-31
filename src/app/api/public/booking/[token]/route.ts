import { NextResponse } from "next/server";
import { getBookingByToken } from "@/lib/booking/queries";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/public/booking/:token
 * حالة حجز أونلاين برقم التتبّع (صفحة تأكيد/متابعة الحجز للمريض).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  if (!booking) {
    return NextResponse.json({ error: "الحجز غير موجود" }, { status: 404 });
  }
  return NextResponse.json({ data: booking });
}
