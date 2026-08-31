import { NextResponse } from "next/server";
import { getClinicBySlug, getAvailableSlots, createOnlineBooking } from "@/lib/booking/queries";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/public/book/:slug?date=YYYY-MM-DD
 * بيانات العيادة + الفتحات المتاحة في اليوم المطلوب.
 * عام (من غير تسجيل دخول) — صفحة الحجز الأونلاين.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const clinic = await getClinicBySlug(slug);
  if (!clinic) {
    return NextResponse.json({ error: "العيادة غير موجودة أو الحجز معطّل" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const date =
    searchParams.get("date") ??
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const slots = clinic.doctor_id
    ? await getAvailableSlots(
        clinic.id,
        clinic.doctor_id,
        date,
        clinic.booking_slot_minutes,
        clinic.work_start_time,
        clinic.work_end_time,
        clinic.working_days
      )
    : [];

  return NextResponse.json({
    data: {
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone,
      doctor_name: clinic.doctor_name,
      slot_minutes: clinic.booking_slot_minutes,
      work_start: clinic.work_start_time,
      work_end: clinic.work_end_time,
      visit_types: clinic.booking_visit_types,
      date,
      slots,
    },
  });
}

/**
 * POST /api/public/book/:slug
 * إنشاء حجز أونلاين جديد (عام — من غير تسجيل دخول).
 * Body: { full_name, phone, age?, gender?, visit_label, date, time, notes? }
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const fullName = String(body.full_name ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const visitLabel = String(body.visit_label ?? "").trim();
  const date = String(body.date ?? "").trim();
  const time = String(body.time ?? "").trim();

  const errors: Record<string, string> = {};
  if (fullName.length < 3) errors.full_name = "اكتب الاسم بالكامل";
  if (phone.replace(/[^0-9]/g, "").length < 8) errors.phone = "رقم هاتف غير صحيح";
  if (!visitLabel) errors.visit_label = "اختر نوع الزيارة";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.date = "تاريخ غير صحيح";
  if (!/^\d{2}:\d{2}$/.test(time)) errors.time = "وقت غير صحيح";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: "بيانات غير صحيحة", issues: errors }, { status: 400 });
  }

  let age: number | null = null;
  if (body.age !== undefined && body.age !== null && body.age !== "") {
    const n = Number(body.age);
    age = Number.isFinite(n) && n > 0 && n < 150 ? Math.round(n) : null;
  }
  const genderRaw = String(body.gender ?? "").trim();
  const gender = genderRaw === "male" || genderRaw === "female" ? genderRaw : null;

  const result = await createOnlineBooking(slug, {
    full_name: fullName,
    phone,
    age,
    gender,
    visit_label: visitLabel,
    date,
    time,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ data: result.booking }, { status: 201 });
}
