import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { deleteAttachmentFile } from "@/lib/attachments/storage";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/attachments/:id
 * حذف مرفق (مثلًا لو اترفع بالغلط). متفلتر بالعيادة عبر الزيارة المرتبطة.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const { rows } = await query<{ id: string; file_url: string }>(
    `SELECT a.id, a.file_url
     FROM attachments a
     JOIN visits v ON v.id = a.visit_id
     WHERE a.id = $1 AND v.clinic_id = $2`,
    [id, clinicId]
  );

  const attachment = rows[0];
  if (!attachment) {
    return NextResponse.json({ error: "المرفق غير موجود" }, { status: 404 });
  }

  await query(`DELETE FROM attachments WHERE id = $1`, [id]);
  await deleteAttachmentFile(attachment.file_url);

  return NextResponse.json({ data: { id } });
}
