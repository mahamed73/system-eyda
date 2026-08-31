import { query } from "@/lib/db";

export type NotificationPriority = "high" | "medium" | "low";

export interface ClinicNotification {
  id: string;
  type: string;
  priority: NotificationPriority;
  title: string;
  detail: string;
  link: string;
}

function fmtDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * بيجيب كل التنبيهات المهمة للعيادة، مرتبة حسب الأولوية
 * (high أحمر → medium برتقالي → low أصفر):
 *  - متابعات متأخرة (high)
 *  - مخزون تحت الحد الأدنى (high)
 *  - مستحقّات مالية غير محصّلة (medium)
 *  - متابعات النهاردة (medium)
 *  - مواعيد النهاردة لسه محجوزة (low)
 *  - متابعات بكرة (low)
 */
export async function getClinicNotifications(clinicId: string): Promise<ClinicNotification[]> {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayStr = fmtDate(today);
  const tomorrowStr = fmtDate(tomorrow);

  const [followUps, lowStock, unpaid, appointmentsToday] = await Promise.all([
    // متابعات: المتأخرة + النهاردة + بكرة (اللي لسه متمش عليها بزيارة أحدث)
    query<{ id: string; follow_up_date: string; patient_name: string }>(
      `SELECT v.id, v.follow_up_date::text AS follow_up_date, p.full_name AS patient_name
       FROM visits v
       JOIN patients p ON p.id = v.patient_id
       WHERE v.clinic_id = $1
         AND v.follow_up_date IS NOT NULL
         AND v.follow_up_date <= $2
         AND NOT EXISTS (
           SELECT 1 FROM visits v2
           WHERE v2.patient_id = v.patient_id
             AND v2.clinic_id = v.clinic_id
             AND v2.id <> v.id
             AND v2.visit_date::date > v.follow_up_date
         )
       ORDER BY v.follow_up_date ASC
       LIMIT 15`,
      [clinicId, tomorrowStr]
    ),
    query<{ id: string; name: string; quantity: number }>(
      `SELECT id, name, quantity FROM inventory_items
       WHERE clinic_id = $1 AND quantity <= min_threshold
       ORDER BY quantity ASC
       LIMIT 10`,
      [clinicId]
    ),
    query<{ id: string; patient_name: string; remaining: number }>(
      `SELECT v.id, p.full_name AS patient_name,
              (v.price - COALESCE(pay.paid, 0)) AS remaining
       FROM visits v
       JOIN patients p ON p.id = v.patient_id
       LEFT JOIN (SELECT visit_id, SUM(amount) AS paid FROM payments GROUP BY visit_id) pay
         ON pay.visit_id = v.id
       WHERE v.clinic_id = $1 AND (v.price - COALESCE(pay.paid, 0)) > 0
       ORDER BY remaining DESC
       LIMIT 10`,
      [clinicId]
    ),
    query<{ count: string }>(
      `SELECT count(*)::text AS count FROM appointments
       WHERE clinic_id = $1 AND scheduled_at::date = $2
         AND status IN ('booked', 'arrived')`,
      [clinicId, todayStr]
    ),
  ]);

  const notifications: ClinicNotification[] = [];

  // متابعات
  for (const f of followUps.rows) {
    const due = f.follow_up_date;
    if (due < todayStr) {
      notifications.push({
        id: `followup-${f.id}`,
        type: "follow_up_overdue",
        priority: "high",
        title: "متابعة متأخرة",
        detail: `${f.patient_name} كان محتاج يرجع من يوم ${due}`,
        link: "/patients",
      });
    } else if (due === todayStr) {
      notifications.push({
        id: `followup-${f.id}`,
        type: "follow_up_today",
        priority: "medium",
        title: "متابعة النهاردة",
        detail: `${f.patient_name} محتاج متابعة النهاردة`,
        link: "/patients",
      });
    } else {
      notifications.push({
        id: `followup-${f.id}`,
        type: "follow_up_upcoming",
        priority: "low",
        title: "متابعة قريبة",
        detail: `${f.patient_name} — متابعة بكرة (${due})`,
        link: "/patients",
      });
    }
  }

  // مخزون
  for (const s of lowStock.rows) {
    notifications.push({
      id: `stock-${s.id}`,
      type: "low_stock",
      priority: "high",
      title: "مخزون منخفض",
      detail: `${s.name} — المتبقي ${s.quantity} فقط`,
      link: "/inventory",
    });
  }

  // مستحقّات مالية
  for (const u of unpaid.rows) {
    notifications.push({
      id: `unpaid-${u.id}`,
      type: "unpaid",
      priority: "medium",
      title: "مستحقّات مالية",
      detail: `${u.patient_name} — متبقي ${u.remaining} ج.م`,
      link: "/visits/new",
    });
  }

  // مواعيد النهاردة
  const todayCount = Number(appointmentsToday.rows[0]?.count ?? 0);
  if (todayCount > 0) {
    notifications.push({
      id: "appointments-today",
      type: "appointments_today",
      priority: "low",
      title: "مواعيد النهاردة",
      detail: `${todayCount} موعد محجوز النهاردة لسه`,
      link: "/appointments",
    });
  }

  // الترتيب حسب الأولوية
  const order: Record<NotificationPriority, number> = { high: 0, medium: 1, low: 2 };
  return notifications.sort((a, b) => order[a.priority] - order[b.priority]);
}
