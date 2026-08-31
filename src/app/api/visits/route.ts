import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { visitInputSchema } from "@/lib/visits/schema";
import { getVisitWithDetails } from "@/lib/visits/queries";

/**
 * POST /api/visits
 * إنشاء زيارة جديدة (كشف). لو مرتبطة بموعد (appointment_id)، بيتحقق إن
 * الموعد بتاع نفس المريض والعيادة، وبعد الإنشاء بيحوّل حالة الموعد لـ
 * "completed" تلقائيًا. ممكن كمان تسجيل دفعة أولية في نفس الطلب.
 */
export async function POST(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const parsed = visitInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { patient_id, doctor_id, appointment_id, diagnosis, prescription, price, follow_up_date, initial_payment } =
    parsed.data;

  const patientCheck = await query(`SELECT id FROM patients WHERE id = $1 AND clinic_id = $2`, [
    patient_id,
    clinicId,
  ]);
  if (patientCheck.rows.length === 0) {
    return NextResponse.json({ error: "المريض غير موجود في هذه العيادة" }, { status: 400 });
  }

  const doctorCheck = await query(
    `SELECT id FROM users WHERE id = $1 AND clinic_id = $2 AND role = 'doctor' AND is_active = true`,
    [doctor_id, clinicId]
  );
  if (doctorCheck.rows.length === 0) {
    return NextResponse.json({ error: "الطبيب غير موجود في هذه العيادة" }, { status: 400 });
  }

  // لو الزيارة مرتبطة بموعد، السعر الافتراضي بيتسحب من سعر الموعد
  // (اللي اتحدد وقت الحجز حسب نوع الزيارة: كشف/متابعة) بدل ما يتكتب تاني.
  let finalPrice = price ?? 0;
  if (appointment_id) {
    const apptCheck = await query<{ id: string; price: string | null }>(
      `SELECT id, price FROM appointments WHERE id = $1 AND clinic_id = $2 AND patient_id = $3`,
      [appointment_id, clinicId, patient_id]
    );
    if (apptCheck.rows.length === 0) {
      return NextResponse.json(
        { error: "الموعد المرتبط غير موجود أو لا يخص هذا المريض" },
        { status: 400 }
      );
    }
    if (price === undefined) {
      finalPrice = apptCheck.rows[0].price != null ? Number(apptCheck.rows[0].price) : 0;
    }
  }

  try {
    const visitId = await withTransaction(async (client) => {
      const visitResult = await client.query<{ id: string }>(
        `INSERT INTO visits (clinic_id, patient_id, appointment_id, doctor_id, diagnosis, prescription, price, follow_up_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          clinicId,
          patient_id,
          appointment_id ?? null,
          doctor_id,
          diagnosis ?? null,
          prescription ?? null,
          finalPrice,
          follow_up_date ?? null,
        ]
      );
      const newVisitId = visitResult.rows[0].id;

      if (initial_payment) {
        await client.query(
          `INSERT INTO payments (visit_id, amount, method) VALUES ($1, $2, $3)`,
          [newVisitId, initial_payment.amount, initial_payment.method]
        );
      }

      if (appointment_id) {
        await client.query(
          `UPDATE appointments SET status = 'completed' WHERE id = $1 AND clinic_id = $2 AND status <> 'cancelled'`,
          [appointment_id, clinicId]
        );
      }

      return newVisitId;
    });

    const created = await getVisitWithDetails(visitId, clinicId);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "تعذّر إنشاء الزيارة" }, { status: 500 });
  }
}
