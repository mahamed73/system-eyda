import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/types";

/**
 * يتأكد إن فيه مستخدم مسجّل دخول، ويرجّع بياناته (فيها clinicId).
 * لو مفيش جلسة بيرجّع Response جاهز بـ 401 عشان نستخدمه مباشرة في الـ route.
 *
 * الاستخدام:
 *   const sessionOrError = await requireSession();
 *   if (sessionOrError instanceof NextResponse) return sessionOrError;
 *   const user = sessionOrError;
 */
export async function requireSession(): Promise<SessionUser | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرّح بالدخول" }, { status: 401 });
  }
  return {
    id: session.user.id,
    clinicId: session.user.clinicId,
    clinicName: session.user.clinicName,
    name: session.user.name ?? "",
    role: session.user.role,
    phone: session.user.phone,
  };
}
