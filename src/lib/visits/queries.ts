import { query } from "@/lib/db";
import type { Payment, Visit, VisitWithDetails } from "@/lib/visits/types";

/**
 * بيجيب زيارة واحدة كاملة (مع اسم الطبيب، المدفوعات، وإجمالي المدفوع/المتبقي)
 * متفلترة بـ clinic_id إجباريًا. بيرجّع null لو مش موجودة أو مش بتاعة العيادة.
 */
export async function getVisitWithDetails(
  visitId: string,
  clinicId: string
): Promise<VisitWithDetails | null> {
  const visitResult = await query<Visit & { doctor_name: string; patient_name: string; patient_phone: string }>(
    `SELECT v.*, u.name AS doctor_name, p.full_name AS patient_name, p.phone AS patient_phone
     FROM visits v
     JOIN users u ON u.id = v.doctor_id
     JOIN patients p ON p.id = v.patient_id
     WHERE v.id = $1 AND v.clinic_id = $2`,
    [visitId, clinicId]
  );

  const visit = visitResult.rows[0];
  if (!visit) return null;

  const paymentsResult = await query<Payment>(
    `SELECT id, visit_id, amount, method, paid_at FROM payments WHERE visit_id = $1 ORDER BY paid_at ASC`,
    [visitId]
  );

  const totalPaid = paymentsResult.rows.reduce((sum, p) => sum + Number(p.amount), 0);
  const remainingBalance = Number(visit.price) - totalPaid;

  // عمود follow_up_date (DATE) بيترجع من pg كـ Date object، فبنحوّله
  // لصيغة YYYY-MM-DD عشان يتعرض صح في حقل الـ date input.
  const rawFollowUp = (visit as unknown as { follow_up_date?: unknown }).follow_up_date;
  const followUpDate =
    rawFollowUp instanceof Date
      ? rawFollowUp.toISOString().slice(0, 10)
      : rawFollowUp
        ? String(rawFollowUp).slice(0, 10)
        : null;

  return {
    ...visit,
    follow_up_date: followUpDate,
    payments: paymentsResult.rows,
    total_paid: totalPaid,
    remaining_balance: remainingBalance,
  };
}
