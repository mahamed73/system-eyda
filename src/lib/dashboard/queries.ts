import { query } from "@/lib/db";

export interface DashboardSummary {
  patients: { total: number; newToday: number };
  appointmentsToday: {
    total: number;
    booked: number;
    arrived: number;
    completed: number;
    cancelled: number;
    noShow: number;
  };
  revenue: { today: number; month: number };
  expenses: { month: number };
  lowStockCount: number;
  revenueTrend: { date: string; total: number }[];
  revenueByType: { type: string; total: number }[];
  ageDistribution: { label: string; count: number }[];
  waitingQueue: {
    id: string;
    patient_id: string;
    patient_name: string;
    patient_phone: string;
    patient_age: number | null;
    patient_gender: string | null;
    blood_type: string | null;
    allergies_notes: string | null;
    has_chronic_disease: boolean | null;
    queue_number: number | null;
    status: string;
    doctor_id: string;
    doctor_name: string;
    arrived_at: string;
    wait_minutes: number | null;
    visit_type: string;
  }[];
  upcomingAppointments: {
    id: string;
    scheduled_at: string;
    status: string;
    patient_name: string;
    doctor_name: string;
  }[];
  recentActivity: {
    id: string;
    type: "patient" | "visit" | "payment";
    label: string;
    detail: string;
    at: string;
  }[];
  doctor?: {
    myAppointmentsToday: number;
    myCompletedToday: number;
    myRevenueToday: number;
    inConsultation: {
      appointment_id: string;
      patient_id: string;
      patient_name: string;
      age: number | null;
      gender: string | null;
      blood_type: string | null;
      allergies_notes: string | null;
      has_chronic_disease: boolean | null;
      last_visit_date: string | null;
      last_diagnosis: string | null;
    } | null;
    myQueue: {
      id: string;
      patient_id: string;
      patient_name: string;
      queue_number: number | null;
      status: string;
      visit_type: string | null;
      wait_minutes: number | null;
      scheduled_at: string;
    }[];
  };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function daysAgoStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function getDashboardSummary(
  clinicId: string,
  user?: { id: string; role: string }
): Promise<DashboardSummary> {
  const today = todayStr();
  const monthStart = monthStartStr();
  const weekAgo = daysAgoStr(6);
  const isDoctor = user?.role === "doctor";

  const [
    patientsTotalResult,
    patientsNewTodayResult,
    appointmentsTodayResult,
    revenueTodayResult,
    revenueMonthResult,
    expensesMonthResult,
    lowStockResult,
    ageDistributionResult,
    revenueTrendResult,
    revenueByTypeResult,
    waitingQueueResult,
    upcomingResult,
    recentPatientsResult,
    recentVisitsResult,
    recentPaymentsResult,
    doctorInConsultResult,
    doctorQueueResult,
    doctorRevenueTodayResult,
  ] = await Promise.all([
    query<{ count: string }>(`SELECT count(*)::text AS count FROM patients WHERE clinic_id = $1`, [
      clinicId,
    ]),
    query<{ count: string }>(
      `SELECT count(*)::text AS count FROM patients WHERE clinic_id = $1 AND created_at::date = $2`,
      [clinicId, today]
    ),
    query<{ status: string; count: string }>(
      `SELECT status, count(*)::text AS count FROM appointments
       WHERE clinic_id = $1 AND scheduled_at::date = $2
       GROUP BY status`,
      [clinicId, today]
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(p.amount), 0)::text AS total
       FROM payments p JOIN visits v ON v.id = p.visit_id
       WHERE v.clinic_id = $1 AND p.paid_at::date = $2`,
      [clinicId, today]
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(p.amount), 0)::text AS total
       FROM payments p JOIN visits v ON v.id = p.visit_id
       WHERE v.clinic_id = $1 AND p.paid_at::date >= $2`,
      [clinicId, monthStart]
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text AS total FROM expenses WHERE clinic_id = $1 AND expense_date >= $2`,
      [clinicId, monthStart]
    ),
    query<{ count: string }>(
      `SELECT count(*)::text AS count FROM inventory_items WHERE clinic_id = $1 AND quantity <= min_threshold`,
      [clinicId]
    ),
    query<{ label: string; count: string }>(
      `SELECT CASE
                WHEN age IS NULL THEN 'غير محدد'
                WHEN age < 13 THEN 'أطفال (0-12)'
                WHEN age < 19 THEN 'مراهقون (13-18)'
                WHEN age < 31 THEN 'شباب (19-30)'
                WHEN age < 46 THEN 'بالغون (31-45)'
                WHEN age < 61 THEN 'متوسطو العمر (46-60)'
                ELSE 'كبار السن (60+)'
              END AS label,
              CASE
                WHEN age < 13 THEN 1 WHEN age < 19 THEN 2 WHEN age < 31 THEN 3
                WHEN age < 46 THEN 4 WHEN age < 61 THEN 5 ELSE 6
              END AS ord,
              count(*)::text AS count
       FROM patients
       WHERE clinic_id = $1
       GROUP BY 1, 2
       ORDER BY 2`,
      [clinicId]
    ),
    query<{ date: string; total: string }>(
      `SELECT p.paid_at::date::text AS date, SUM(p.amount)::text AS total
       FROM payments p JOIN visits v ON v.id = p.visit_id
       WHERE v.clinic_id = $1 AND p.paid_at::date >= $2
       GROUP BY p.paid_at::date
       ORDER BY date ASC`,
      [clinicId, weekAgo]
    ),
    query<{ type: string; total: string }>(
      `SELECT COALESCE(a.visit_type, 'walk_in') AS type, SUM(p.amount)::text AS total
       FROM payments p
       JOIN visits v ON v.id = p.visit_id
       LEFT JOIN appointments a ON a.id = v.appointment_id
       WHERE v.clinic_id = $1 AND p.paid_at::date >= $2
       GROUP BY COALESCE(a.visit_type, 'walk_in')
       ORDER BY total DESC`,
      [clinicId, monthStart]
    ),
    query<{
      id: string;
      patient_id: string;
      patient_name: string;
      patient_phone: string;
      patient_age: number | null;
      patient_gender: string | null;
      blood_type: string | null;
      allergies_notes: string | null;
      has_chronic_disease: boolean | null;
      queue_number: number | null;
      status: string;
      doctor_id: string;
      doctor_name: string;
      arrived_at: string;
      wait_minutes: number | null;
      visit_type: string;
    }>(
      `SELECT a.id, a.patient_id, p.full_name AS patient_name, p.phone AS patient_phone,
              p.age AS patient_age, p.gender AS patient_gender, p.blood_type,
              p.allergies_notes, p.has_chronic_disease,
              a.queue_number, a.status, a.doctor_id, u.name AS doctor_name,
              COALESCE(a.arrived_at, a.scheduled_at)::text AS arrived_at, a.visit_type,
              CASE WHEN a.arrived_at IS NOT NULL
                THEN ROUND(EXTRACT(EPOCH FROM (COALESCE(a.started_at, now()) - a.arrived_at))/60)::int
                ELSE NULL END AS wait_minutes
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN users u ON u.id = a.doctor_id
       WHERE a.clinic_id = $1
         AND a.local_date = $2
         AND a.status IN ('arrived','in_consultation')
       ORDER BY CASE a.status WHEN 'in_consultation' THEN 0 ELSE 1 END,
                a.priority DESC, a.queue_number ASC NULLS LAST
       LIMIT 15`,
      [clinicId, today]
    ),
    query<{
      id: string;
      scheduled_at: string;
      status: string;
      patient_name: string;
      doctor_name: string;
    }>(
      `SELECT a.id, a.scheduled_at, a.status, p.full_name AS patient_name, u.name AS doctor_name
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       JOIN users u ON u.id = a.doctor_id
       WHERE a.clinic_id = $1 AND a.scheduled_at::date = $2
         AND a.status NOT IN ('cancelled', 'no_show')
       ORDER BY a.scheduled_at ASC
       LIMIT 6`,
      [clinicId, today]
    ),
    query<{ id: string; full_name: string; created_at: string }>(
      `SELECT id, full_name, created_at FROM patients
       WHERE clinic_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [clinicId]
    ),
    query<{ id: string; patient_name: string; price: string; created_at: string }>(
      `SELECT v.id, p.full_name AS patient_name, v.price::text AS price, v.created_at
       FROM visits v JOIN patients p ON p.id = v.patient_id
       WHERE v.clinic_id = $1 ORDER BY v.created_at DESC LIMIT 5`,
      [clinicId]
    ),
    query<{ id: string; patient_name: string; amount: string; paid_at: string }>(
      `SELECT pay.id, p.full_name AS patient_name, pay.amount::text AS amount, pay.paid_at
       FROM payments pay
       JOIN visits v ON v.id = pay.visit_id
       JOIN patients p ON p.id = v.patient_id
       WHERE v.clinic_id = $1 ORDER BY pay.paid_at DESC LIMIT 5`,
      [clinicId]
    ),
    // بيانات خاصة بالطبيب: مريضه الحالي جوه الكشف
    query<{
      appointment_id: string;
      patient_id: string;
      patient_name: string;
      age: number | null;
      gender: string | null;
      blood_type: string | null;
      allergies_notes: string | null;
      has_chronic_disease: boolean | null;
      last_visit_date: string | null;
      last_diagnosis: string | null;
    }>(
      `SELECT a.id AS appointment_id, a.patient_id, p.full_name AS patient_name,
              p.age, p.gender, p.blood_type, p.allergies_notes, p.has_chronic_disease,
              (SELECT v.visit_date::text FROM visits v
               WHERE v.patient_id = p.id AND v.clinic_id = a.clinic_id
               ORDER BY v.visit_date DESC LIMIT 1) AS last_visit_date,
              (SELECT v.diagnosis FROM visits v
               WHERE v.patient_id = p.id AND v.clinic_id = a.clinic_id
               ORDER BY v.visit_date DESC LIMIT 1) AS last_diagnosis
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.clinic_id = $1 AND a.doctor_id = $2 AND a.status = 'in_consultation'
       ORDER BY a.started_at DESC LIMIT 1`,
      [clinicId, user?.id ?? "00000000-0000-0000-0000-000000000000"]
    ),
    // طابور الطبيب نفسه النهاردة
    query<{
      id: string;
      patient_id: string;
      patient_name: string;
      queue_number: number | null;
      status: string;
      visit_type: string | null;
      wait_minutes: number | null;
      scheduled_at: string;
    }>(
      `SELECT a.id, a.patient_id, p.full_name AS patient_name, a.queue_number,
              a.status, a.visit_type, a.scheduled_at::text AS scheduled_at,
              CASE WHEN a.arrived_at IS NOT NULL
                THEN ROUND(EXTRACT(EPOCH FROM (COALESCE(a.started_at, now()) - a.arrived_at))/60)::int
                ELSE NULL END AS wait_minutes
       FROM appointments a
       JOIN patients p ON p.id = a.patient_id
       WHERE a.clinic_id = $1 AND a.doctor_id = $2 AND a.local_date = $3
         AND a.status NOT IN ('cancelled','no_show')
       ORDER BY a.scheduled_at ASC`,
      [clinicId, user?.id ?? "00000000-0000-0000-0000-000000000000", today]
    ),
    query<{ total: string }>(
      `SELECT COALESCE(SUM(pay.amount), 0)::text AS total
       FROM payments pay JOIN visits v ON v.id = pay.visit_id
       WHERE v.clinic_id = $1 AND v.doctor_id = $2 AND pay.paid_at::date = $3`,
      [clinicId, user?.id ?? "00000000-0000-0000-0000-000000000000", today]
    ),
  ]);

  const statusCounts: Record<string, number> = {};
  let appointmentsTotal = 0;
  for (const row of appointmentsTodayResult.rows) {
    statusCounts[row.status] = Number(row.count);
    appointmentsTotal += Number(row.count);
  }

  const recentActivity = [
    ...recentPatientsResult.rows.map((r) => ({
      id: `patient-${r.id}`,
      type: "patient" as const,
      label: "مريض جديد",
      detail: r.full_name,
      at: r.created_at,
    })),
    ...recentVisitsResult.rows.map((r) => ({
      id: `visit-${r.id}`,
      type: "visit" as const,
      label: "كشف جديد",
      detail: `${r.patient_name} — ${r.price} ج.م`,
      at: r.created_at,
    })),
    ...recentPaymentsResult.rows.map((r) => ({
      id: `payment-${r.id}`,
      type: "payment" as const,
      label: "دفعة جديدة",
      detail: `${r.patient_name} — ${r.amount} ج.م`,
      at: r.paid_at,
    })),
  ]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 8);

  return {
    patients: {
      total: Number(patientsTotalResult.rows[0]?.count ?? 0),
      newToday: Number(patientsNewTodayResult.rows[0]?.count ?? 0),
    },
    appointmentsToday: {
      total: appointmentsTotal,
      booked: statusCounts.booked ?? 0,
      arrived: statusCounts.arrived ?? 0,
      completed: statusCounts.completed ?? 0,
      cancelled: statusCounts.cancelled ?? 0,
      noShow: statusCounts.no_show ?? 0,
    },
    revenue: {
      today: Number(revenueTodayResult.rows[0]?.total ?? 0),
      month: Number(revenueMonthResult.rows[0]?.total ?? 0),
    },
    expenses: { month: Number(expensesMonthResult.rows[0]?.total ?? 0) },
    lowStockCount: Number(lowStockResult.rows[0]?.count ?? 0),
    revenueTrend: revenueTrendResult.rows.map((r) => ({ date: r.date, total: Number(r.total) })),
    revenueByType: revenueByTypeResult.rows.map((r) => ({ type: r.type, total: Number(r.total) })),
    ageDistribution: ageDistributionResult.rows.map((r) => ({ label: r.label, count: Number(r.count) })),
    waitingQueue: waitingQueueResult.rows,
    upcomingAppointments: upcomingResult.rows,
    recentActivity,
    doctor: isDoctor
      ? {
          myAppointmentsToday: doctorQueueResult.rows.length,
          myCompletedToday: doctorQueueResult.rows.filter((r) => r.status === "completed").length,
          myRevenueToday: Number(doctorRevenueTodayResult.rows[0]?.total ?? 0),
          inConsultation: doctorInConsultResult.rows[0] ?? null,
          myQueue: doctorQueueResult.rows,
        }
      : undefined,
  };
}
