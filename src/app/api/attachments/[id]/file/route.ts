import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { resolveAttachmentPath } from "@/lib/attachments/storage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/attachments/:id/file
 * بيسمح بتحميل/عرض محتوى الملف الفعلي، بعد التحقق من الجلسة وإن
 * المرفق ده بتاع نفس عيادة المستخدم. الملفات مش متخزنة في public/
 * عشان محدش يقدر يوصلها من غير المرور من هنا (خصوصية البيانات الطبية).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const { rows } = await query<{ file_url: string; mime_type: string | null; original_name: string | null }>(
    `SELECT a.file_url, a.mime_type, a.original_name
     FROM attachments a
     JOIN visits v ON v.id = a.visit_id
     WHERE a.id = $1 AND v.clinic_id = $2`,
    [id, clinicId]
  );

  const attachment = rows[0];
  if (!attachment) {
    return NextResponse.json({ error: "المرفق غير موجود" }, { status: 404 });
  }

  try {
    const buffer = await readFile(/* turbopackIgnore: true */ resolveAttachmentPath(attachment.file_url));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": attachment.mime_type ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.original_name ?? "file")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "تعذّر قراءة الملف" }, { status: 500 });
  }
}
