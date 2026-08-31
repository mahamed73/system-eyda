import { NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import {
  markArrived,
  markInConsultation,
  markCompleted,
  returnToWaiting,
  togglePriority,
  getQueue,
} from "@/lib/queue/queries";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/queue/:id
 * تغيير حالة مريض في قائمة الدور:
 *   { "action": "arrive" }       تسجيل حضور (بيتسند رقم دور)
 *   { "action": "start" }        بدء الكشف (جوه العيادة)
 *   { "action": "complete" }     إنهاء الكشف
 *   { "action": "back" }         إرجاع للانتظار
 *   { "action": "priority" }     تبديل الأولوية (طارئ)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const action: string = body?.action ?? "";

  let result: unknown = null;
  switch (action) {
    case "arrive":
      result = await markArrived(clinicId, id);
      break;
    case "start":
      result = await markInConsultation(clinicId, id);
      break;
    case "complete":
      result = await markCompleted(clinicId, id);
      break;
    case "back":
      result = await returnToWaiting(clinicId, id);
      break;
    case "priority":
      result = await togglePriority(clinicId, id);
      break;
    default:
      return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  }

  if (!result) {
    return NextResponse.json(
      { error: "الموعد غير موجود أو الحالة لا تسمح بهذا الإجراء" },
      { status: 404 }
    );
  }

  const { items, summary } = await getQueue(clinicId);
  return NextResponse.json({ data: result, queue: items, summary });
}
