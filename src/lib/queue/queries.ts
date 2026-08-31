import { query } from "@/lib/db";

export type QueueStatus = "arrived" | "in_consultation" | "completed";

export interface QueueItem {
  id: string;
  queue_number: number;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  doctor_name: string;
  doctor_id: string;
  status: string;
  visit_type: string | null;
  priority: number;
  scheduled_at: string;
  arrived_at: string | null;
  started_at: string | null;
  /** مدة الانتظار بالدقائق (من الحضور حتى الآن أو حتى بدء الكشف) */
  wait_minutes: number | null;
}

export interface QueueSummary {
  waiting_count: number;
  in_consultation_count: number;
  completed_count: number;
  next_number: number;
}

/**
 * قائمة الدور لعيادة في يوم محدد (افتراضيًا النهاردة بتوقيت القاهرة).
 *
 * الترتيب (نظام الدور الذكي):
 *   1) جوه الكشف (in_consultation) في الأول — لكن في الواجهة بنعرضهم قسم منفصل
 *   2) بعد كده الحاضرين (arrived) مترتبين: الأولوية الأول، ثم رقمالدور
 *   3) وأخيرًا المكتملين (completed) النهاردة
 */
export async function getQueue(
  clinicId: string,
  dateStr?: string
): Promise<{ items: QueueItem[]; summary: QueueSummary }> {
  const day = dateStr ?? cairoToday();

  const { rows } = await query<QueueItem>(
    `SELECT a.id, a.queue_number, a.patient_id, p.full_name AS patient_name,
            p.phone AS patient_phone, u.name AS doctor_name, u.id AS doctor_id,
            a.status, a.visit_type, a.priority,
            a.scheduled_at::text AS scheduled_at,
            a.arrived_at::text AS arrived_at,
            a.started_at::text AS started_at,
            CASE
              WHEN a.arrived_at IS NOT NULL AND a.started_at IS NOT NULL
                THEN ROUND(EXTRACT(EPOCH FROM (a.started_at - a.arrived_at))/60)::int
              WHEN a.arrived_at IS NOT NULL
                THEN ROUND(EXTRACT(EPOCH FROM (now() - a.arrived_at))/60)::int
              ELSE NULL
            END AS wait_minutes
     FROM appointments a
     JOIN patients p ON p.id = a.patient_id
     JOIN users u ON u.id = a.doctor_id
     WHERE a.clinic_id = $1
       AND a.local_date = $2
       AND a.status IN ('arrived','in_consultation','completed')
     ORDER BY
       CASE a.status WHEN 'in_consultation' THEN 0 WHEN 'arrived' THEN 1 ELSE 2 END,
       a.priority DESC,
       a.queue_number ASC NULLS LAST`,
    [clinicId, day]
  );

  const waiting = rows.filter((r) => r.status === "arrived");
  const inConsult = rows.filter((r) => r.status === "in_consultation");
  const done = rows.filter((r) => r.status === "completed");

  // أكبر رقم دور النهاردة + 1 (للحجز التالي)
  const maxNo = rows.reduce((m, r) => Math.max(m, r.queue_number ?? 0), 0);

  return {
    items: rows,
    summary: {
      waiting_count: waiting.length,
      in_consultation_count: inConsult.length,
      completed_count: done.length,
      next_number: maxNo + 1,
    },
  };
}

/**
 * تسجيل الحضور (Check-in): بيتسند رقم دور جديد لو لسه ماخدش،
 * وبتتسجل ساعة الحضور، والحالة بتبقى arrived.
 * رقم الدور بيُحسب على يوم الموعد نفسه (مش يوم الجهاز) عشان
 * الحضور المبكر لموعد بكرة ياخد رقم في يوم بكرة الصح.
 */
export async function markArrived(clinicId: string, appointmentId: string) {
  const { rows } = await query(
    `UPDATE appointments a
     SET status = 'arrived',
         arrived_at = COALESCE(a.arrived_at, now()),
         queue_number = COALESCE(a.queue_number,
             (SELECT COALESCE(MAX(queue_number), 0) + 1
              FROM appointments x
              WHERE x.clinic_id = a.clinic_id AND x.local_date = a.local_date))
     WHERE a.id = $1 AND a.clinic_id = $2
     RETURNING a.id, a.queue_number, a.status, a.local_date::text AS local_date`,
    [appointmentId, clinicId]
  );
  return rows[0] ?? null;
}

/** بدء الكشف: arrived → in_consultation + تسجيل وقت البداية */
export async function markInConsultation(clinicId: string, appointmentId: string) {
  const { rows } = await query(
    `UPDATE appointments
     SET status = 'in_consultation', started_at = COALESCE(started_at, now())
     WHERE id = $1 AND clinic_id = $2 AND status IN ('arrived','in_consultation')
     RETURNING id, status`,
    [appointmentId, clinicId]
  );
  return rows[0] ?? null;
}

/** إنهاء الكشف: in_consultation/arrived → completed */
export async function markCompleted(clinicId: string, appointmentId: string) {
  const { rows } = await query(
    `UPDATE appointments
     SET status = 'completed'
     WHERE id = $1 AND clinic_id = $2 AND status IN ('arrived','in_consultation')
     RETURNING id, status`,
    [appointmentId, clinicId]
  );
  return rows[0] ?? null;
}

/** إرجاع مريض للانتظار (لو اتنادى بالغلط): in_consultation → arrived */
export async function returnToWaiting(clinicId: string, appointmentId: string) {
  const { rows } = await query(
    `UPDATE appointments
     SET status = 'arrived'
     WHERE id = $1 AND clinic_id = $2 AND status = 'in_consultation'
     RETURNING id, status`,
    [appointmentId, clinicId]
  );
  return rows[0] ?? null;
}

/** تبديل الأولوية (حالة طارئة) */
export async function togglePriority(clinicId: string, appointmentId: string) {
  const { rows } = await query(
    `UPDATE appointments
     SET priority = CASE WHEN priority = 0 THEN 1 ELSE 0 END
     WHERE id = $1 AND clinic_id = $2
     RETURNING id, priority`,
    [appointmentId, clinicId]
  );
  return rows[0] ?? null;
}

/**
 * شاشة الانتظار العامة (شاشة التلفزيون في الاستقبال):
 * بيانات مبسّطة من غير هواتف — رقم الدور + اسم المريض + حالته فقط.
 */
export async function getPublicWaitingScreen(clinicSlug: string) {
  const clinic = await query<{ id: string; name: string }>(
    `SELECT id, name FROM clinics WHERE booking_slug = $1 AND online_booking_enabled = true`,
    [clinicSlug]
  );
  if (clinic.rows.length === 0) return null;

  const { items, summary } = await getQueue(clinic.rows[0].id);

  // مبادلة الاسم الأول بالاسم الأخير (نفس العنوان) للخصوصية
  const maskName = (full: string) => {
    const parts = full.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
  };

  const nowInConsult = items
    .filter((i) => i.status === "in_consultation")
    .map((i) => ({ queue_number: i.queue_number, name: maskName(i.patient_name) }));

  const waiting = items
    .filter((i) => i.status === "arrived")
    .map((i) => ({
      queue_number: i.queue_number,
      name: maskName(i.patient_name),
      wait_minutes: i.wait_minutes,
      priority: i.priority,
      doctor_name: i.doctor_name,
    }));

  const lastDone = items
    .filter((i) => i.status === "completed")
    .slice(-3)
    .map((i) => ({ queue_number: i.queue_number, name: maskName(i.patient_name) }));

  return {
    clinic_name: clinic.rows[0].name,
    now: nowInConsult,
    waiting,
    last_done: lastDone,
    waiting_count: summary.waiting_count,
  };
}

/** تاريخ النهاردة بتوقيت القاهرة (YYYY-MM-DD) */
export function cairoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
