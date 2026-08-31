import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { query } from "@/lib/db";

/**
 * GET /api/clinic/settings
 * إعدادات العيادة (خصوصًا إعدادات الحجز الأونلاين).
 */
export async function GET() {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { rows } = await query(
    `SELECT name, address, phone, city, booking_slug, online_booking_enabled,
            booking_slot_minutes, work_start_time::text AS work_start_time,
            work_end_time::text AS work_end_time, working_days, booking_visit_types
     FROM clinics WHERE id = $1`,
    [clinicId]
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "العيادة غير موجودة" }, { status: 404 });
  }
  const r = rows[0];
  return NextResponse.json({
    data: {
      ...r,
      work_start_time: String(r.work_start_time).slice(0, 5),
      work_end_time: String(r.work_end_time).slice(0, 5),
      working_days: r.working_days ?? [0, 1, 2, 3, 4, 5, 6],
      booking_visit_types:
        Array.isArray(r.booking_visit_types) && r.booking_visit_types.length > 0
          ? r.booking_visit_types
          : [{ label: "كشف", price: 300 }],
    },
  });
}

const SLUG_RE = /^[a-z0-9-]{3,60}$/;

/**
 * PATCH /api/clinic/settings
 * تعديل إعدادات الحجز: التفعيل، الـ slug، الساعات، مدة الموعد، أنواع الزيارة.
 */
export async function PATCH(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });

  const sets: string[] = [];
  const values: unknown[] = [];

  if (typeof body.online_booking_enabled === "boolean") {
    values.push(body.online_booking_enabled);
    sets.push(`online_booking_enabled = $${values.length}`);
  }
  if (body.booking_slug !== undefined) {
    const slug = String(body.booking_slug).trim().toLowerCase();
    if (slug && !SLUG_RE.test(slug)) {
      return NextResponse.json(
        { error: "الرابط لازم يكون حروف إنجليزية صغيرة وأرقام وشرطة بس (3-60 حرف)" },
        { status: 400 }
      );
    }
    if (slug) {
      const clash = await query(
        `SELECT id FROM clinics WHERE booking_slug = $1 AND id <> $2`,
        [slug, clinicId]
      );
      if (clash.rows.length > 0) {
        return NextResponse.json({ error: "الرابط ده مستخدم من عيادة تانية" }, { status: 409 });
      }
    }
    values.push(slug || null);
    sets.push(`booking_slug = $${values.length}`);
  }
  if (body.booking_slot_minutes !== undefined) {
    const n = Number(body.booking_slot_minutes);
    if (![10, 15, 20, 30, 45, 60].includes(n)) {
      return NextResponse.json({ error: "مدة الموعد غير صحيحة" }, { status: 400 });
    }
    values.push(n);
    sets.push(`booking_slot_minutes = $${values.length}`);
  }
  if (body.work_start_time !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(body.work_start_time))
      return NextResponse.json({ error: "وقت بداية غير صحيح" }, { status: 400 });
    values.push(body.work_start_time);
    sets.push(`work_start_time = $${values.length}::time`);
  }
  if (body.work_end_time !== undefined) {
    if (!/^\d{2}:\d{2}$/.test(body.work_end_time))
      return NextResponse.json({ error: "وقت نهاية غير صحيح" }, { status: 400 });
    values.push(body.work_end_time);
    sets.push(`work_end_time = $${values.length}::time`);
  }
  if (Array.isArray(body.working_days)) {
    const days = (body.working_days as unknown[])
      .map(Number)
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    values.push(days);
    sets.push(`working_days = $${values.length}`);
  }
  if (Array.isArray(body.booking_visit_types)) {
    const types = body.booking_visit_types
      .filter((t: { label?: unknown; price?: unknown }) => typeof t.label === "string" && t.label.trim())
      .map((t: { label: string; price: unknown }) => ({
        label: String(t.label).trim().slice(0, 50),
        price: Math.max(0, Number(t.price) || 0),
      }));
    if (types.length === 0) {
      return NextResponse.json({ error: "لازم نوع زيارة واحد على الأقل" }, { status: 400 });
    }
    values.push(JSON.stringify(types));
    sets.push(`booking_visit_types = $${values.length}::jsonb`);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "مفيش بيانات للتعديل" }, { status: 400 });
  }

  values.push(clinicId);
  await query(
    `UPDATE clinics SET ${sets.join(", ")} WHERE id = $${values.length}`,
    values
  );

  return NextResponse.json({ data: { ok: true } });
}
