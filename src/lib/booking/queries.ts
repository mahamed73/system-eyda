import { query } from "@/lib/db";
import { findConflictingAppointment } from "@/lib/appointments/conflict";

export interface BookingClinicInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  booking_slot_minutes: number;
  work_start_time: string;
  work_end_time: string;
  working_days: number[];
  booking_visit_types: { label: string; price: number }[];
  doctor_id: string | null;
  doctor_name: string | null;
}

/**
 * بيانات العيادة اللي بتظهر في صفحة الحجز العامة (من الـ slug).
 */
export async function getClinicBySlug(slug: string): Promise<BookingClinicInfo | null> {
  const { rows } = await query(
    `SELECT c.id, c.name, c.address, c.phone, c.booking_slot_minutes,
            c.work_start_time::text AS work_start_time,
            c.work_end_time::text AS work_end_time,
            c.working_days, c.booking_visit_types,
            d.id AS doctor_id, d.name AS doctor_name
     FROM clinics c
     LEFT JOIN LATERAL (
       SELECT id, name FROM users
       WHERE clinic_id = c.id AND role = 'doctor' AND is_active = true
       ORDER BY created_at ASC LIMIT 1
     ) d ON true
     WHERE c.booking_slug = $1 AND c.online_booking_enabled = true`,
    [slug]
  );
  const row = rows[0] as unknown as {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    booking_slot_minutes: number;
    work_start_time: string;
    work_end_time: string;
    working_days: unknown;
    booking_visit_types: unknown;
    doctor_id: string | null;
    doctor_name: string | null;
  };
  if (!row) return null;
  const visitTypesRaw = Array.isArray(row.booking_visit_types)
    ? (row.booking_visit_types as { label: string; price: number }[])
    : [];
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    booking_slot_minutes: row.booking_slot_minutes,
    work_start_time: String(row.work_start_time).slice(0, 5),
    work_end_time: String(row.work_end_time).slice(0, 5),
    working_days: Array.isArray(row.working_days)
      ? (row.working_days as number[]).map(Number)
      : [0, 1, 2, 3, 4, 5, 6],
    booking_visit_types: visitTypesRaw,
    doctor_id: row.doctor_id,
    doctor_name: row.doctor_name,
  };
}

/**
 * المواعيد المتاحة للحجز في يوم معين: فتحات بين ساعات العمل،
 * مستبعدين الفترات المحجوزة/الماضي وبره أيام العمل.
 */
export async function getAvailableSlots(
  clinicId: string,
  doctorId: string,
  dateStr: string,
  slotMinutes: number,
  workStart: string,
  workEnd: string,
  workingDays: number[]
): Promise<string[]> {
  // اليوم ده من أيام العمل؟ (الأحد=0 ... السبت=6 — نفس ترقيم JS لكن Cairo)
  const date = new Date(`${dateStr}T12:00:00`);
  const jsDay = date.getDay(); // الأحد 0
  // الأرقام في القاعدة: 0=الأحد (نفس ترقيم JS)
  if (!workingDays.includes(jsDay)) return [];

  // المواعيد المحجوزة النشطة في اليوم ده (مواعيد الطبيب)
  const { rows } = await query<{ scheduled_at: string; duration_minutes: number }>(
    `SELECT scheduled_at::text AS scheduled_at, duration_minutes
     FROM appointments
     WHERE clinic_id = $1 AND doctor_id = $2
       AND local_date = $3
       AND status NOT IN ('cancelled', 'no_show')`,
    [clinicId, doctorId, dateStr]
  );

  const busy = rows.map((r) => ({
    start: new Date(r.scheduled_at).getTime(),
    end: new Date(r.scheduled_at).getTime() + r.duration_minutes * 60_000,
  }));

  const now = Date.now();
  const slots: string[] = [];
  const [sh, sm] = workStart.split(":").map(Number);
  const [eh, em] = workEnd.split(":").map(Number);

  let cursor = new Date(`${dateStr}T00:00:00`);
  cursor.setHours(sh, sm, 0, 0);
  const end = new Date(`${dateStr}T00:00:00`);
  end.setHours(eh, em, 0, 0);

  while (cursor.getTime() + slotMinutes * 60_000 <= end.getTime()) {
    const s = cursor.getTime();
    const e = s + slotMinutes * 60_000;
    const inPast = e <= now;
    const overlaps = busy.some((b) => s < b.end && b.start < e);
    if (!inPast && !overlaps) {
      slots.push(cursor.toTimeString().slice(0, 5));
    }
    cursor = new Date(s + slotMinutes * 60_000);
  }
  return slots;
}

export interface BookingInput {
  full_name: string;
  phone: string;
  age?: number | null;
  gender?: "male" | "female" | null;
  visit_label: string; // اسم نوع الزيارة من إعدادات العيادة (كشف/متابعة...)
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  notes?: string | null;
}

/**
 * إنشاء حجز أونلاين:
 *  - المريض: لو فيه مريض بنفس التليفون في العيادة بنستخدمه، غير كده بننشئه.
 *  - الزيارة: visit_type=checkup لو الاسم "كشف"، follow_up لو "متابعة"،
 *    وغير كده checkup (والاسم متسجل في حقل مستقل لو احتجناه لاحقًا).
 *  - السعر بيتسحب من إعدادات العيادة (booking_visit_types).
 *  - فحص التعارض + فحص وقت العمل قبل الحجز.
 * بيرجّع الحجز الجديد مع الـ token بتاعه (لمتابعة/إلغاء الحجز ذاتيًا).
 */
export async function createOnlineBooking(slug: string, input: BookingInput) {
  const clinic = await getClinicBySlug(slug);
  if (!clinic || !clinic.doctor_id) {
    return { error: "العيادة غير موجودة أو الحجز غير متاح حاليًا", status: 404 as const };
  }

  const visitTypeConf = (clinic.booking_visit_types ?? []).find(
    (v) => v.label === input.visit_label
  );
  if (!visitTypeConf) {
    return { error: "نوع الزيارة غير متاح", status: 400 as const };
  }

  const [y, m, d] = input.date.split("-").map(Number);
  const [hh, mm] = input.time.split(":").map(Number);
  if (!y || !m || !d || hh === undefined || mm === undefined) {
    return { error: "تاريخ أو وقت غير صحيح", status: 400 as const };
  }
  const scheduledAt = new Date(`${input.date}T${input.time.padStart(5, "0")}:00`);

  // يوم عمل؟
  const jsDay = scheduledAt.getDay();
  if (!clinic.working_days.includes(jsDay)) {
    return { error: "العيادة لا تعمل في اليوم المحدد", status: 400 as const };
  }

  // جوه ساعات العمل؟
  const timeStr = input.time.padStart(5, "0");
  if (timeStr < clinic.work_start_time || timeStr >= clinic.work_end_time) {
    return { error: "الوقت المحدد خارج ساعات العمل", status: 400 as const };
  }

  // فتحات؟ (سريع: فحص التعارض يكفي)
  const conflict = await findConflictingAppointment({
    clinicId: clinic.id,
    doctorId: clinic.doctor_id,
    scheduledAt,
    durationMinutes: clinic.booking_slot_minutes,
  });
  if (conflict) {
    return { error: "عذرًا، هذا الموعد محجوز — اختر وقتًا آخر", status: 409 as const };
  }

  // المريض نفسه بالتليفون؟
  const digits = input.phone.replace(/[^0-9]/g, "");
  const existing = await query<{ id: string }>(
    `SELECT id FROM patients
     WHERE clinic_id = $1 AND regexp_replace(phone, '[^0-9]', '', 'g') = $2
     LIMIT 1`,
    [clinic.id, digits]
  );

  let patientId: string;
  if (existing.rows[0]) {
    patientId = existing.rows[0].id;
  } else {
    const created = await query<{ id: string }>(
      `INSERT INTO patients (clinic_id, full_name, phone, age, gender)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [clinic.id, input.full_name.trim(), input.phone.trim(), input.age ?? null, input.gender ?? null]
    );
    patientId = created.rows[0].id;
  }

  const visitType = input.visit_label.includes("متابعة") ? "follow_up" : "checkup";

  const appt = await query<{ id: string; booking_token: string }>(
    `INSERT INTO appointments
       (clinic_id, patient_id, doctor_id, scheduled_at, duration_minutes,
        status, visit_type, price, booking_source, notes)
     VALUES ($1, $2, $3, $4, $5, 'booked', $6, $7, 'online', $8)
     RETURNING id, booking_token`,
    [
      clinic.id,
      patientId,
      clinic.doctor_id,
      scheduledAt.toISOString(),
      clinic.booking_slot_minutes,
      visitType,
      visitTypeConf.price,
      input.notes ?? null,
    ]
  );

  return {
    booking: {
      id: appt.rows[0].id,
      token: appt.rows[0].booking_token,
      patient_name: input.full_name,
      date: input.date,
      time: input.time,
      visit_label: visitTypeConf.label,
      price: visitTypeConf.price,
      clinic_name: clinic.name,
    },
  };
}

/** تفاصيل حجز برقم الـ token (صفحة المتابعة بعد الحجز) */
export async function getBookingByToken(token: string) {
  const { rows } = await query(
    `SELECT a.id, a.booking_token, a.scheduled_at::text AS scheduled_at, a.status,
            a.visit_type, a.price, a.queue_number,
            p.full_name AS patient_name, p.phone AS patient_phone,
            c.name AS clinic_name, c.phone AS clinic_phone, c.address AS clinic_address
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN clinics c ON c.id = a.clinic_id
     WHERE a.booking_token = $1`,
    [token]
  );
  return rows[0] ?? null;
}
