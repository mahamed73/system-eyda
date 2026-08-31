import { NextResponse } from "next/server";
import { getPublicWaitingScreen } from "@/lib/queue/queries";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/public/screen/:slug
 * بيانات شاشة الانتظار العامة (شاشة التلفزيون في الاستقبال) —
 * من غير تسجيل دخول، ومن غير أي بيانات حساسة (الهاتف مخفي).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const data = await getPublicWaitingScreen(slug);
  if (!data) {
    return NextResponse.json({ error: "العيادة غير موجودة أو الحجز معطّل" }, { status: 404 });
  }
  return NextResponse.json({ data });
}
