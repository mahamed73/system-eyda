import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

/**
 * GET /api/health
 * فحص صحة التطبيق وقاعدة البيانات — من غير تسجيل دخول،
 * مفيد لأدوات مراقبة الـ uptime (UptimeRobot وغيره).
 */
export async function GET() {
  const status: Record<string, unknown> = {
    status: "ok",
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  };

  try {
    const dbRes = await pool.query("SELECT 1");
    status.database = dbRes.rows.length === 1 ? "ok" : "unknown";
    return NextResponse.json(status, { status: 200 });
  } catch {
    status.status = "degraded";
    status.database = "error";
    return NextResponse.json(status, { status: 503 });
  }
}
