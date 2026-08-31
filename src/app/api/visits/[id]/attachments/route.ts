import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import {
  ALLOWED_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
  saveAttachmentFile,
} from "@/lib/attachments/storage";
import type { Attachment, AttachmentType } from "@/lib/attachments/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_TYPES: AttachmentType[] = ["xray", "lab", "prescription_scan", "other"];

async function assertVisitInClinic(visitId: string, clinicId: string) {
  const { rows } = await query(`SELECT id FROM visits WHERE id = $1 AND clinic_id = $2`, [
    visitId,
    clinicId,
  ]);
  return rows.length > 0;
}

/**
 * GET /api/visits/:id/attachments
 * قائمة مرفقات زيارة معيّنة (متفلترة بالعيادة عبر الزيارة).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id: visitId } = await params;

  if (!(await assertVisitInClinic(visitId, clinicId))) {
    return NextResponse.json({ error: "الزيارة غير موجودة" }, { status: 404 });
  }

  const { rows } = await query<Attachment>(
    `SELECT * FROM attachments WHERE visit_id = $1 ORDER BY uploaded_at DESC`,
    [visitId]
  );

  const data = rows.map((a) => ({ ...a, download_url: `/api/attachments/${a.id}/file` }));
  return NextResponse.json({ data });
}

/**
 * POST /api/visits/:id/attachments
 * رفع مرفق طبي جديد (صورة أشعة/تحليل/وصفة ممسوحة...) لزيارة معيّنة.
 * multipart/form-data: file + file_type
 */
export async function POST(request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId, id: userId } = sessionOrError;
  const { id: visitId } = await params;

  if (!(await assertVisitInClinic(visitId, clinicId))) {
    return NextResponse.json({ error: "الزيارة غير موجودة" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "بيانات الرفع غير صحيحة" }, { status: 400 });
  }

  const file = formData.get("file");
  const fileTypeRaw = formData.get("file_type");
  const fileType = typeof fileTypeRaw === "string" ? fileTypeRaw : "other";

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "لازم ترفع ملف" }, { status: 400 });
  }

  if (!VALID_TYPES.includes(fileType as AttachmentType)) {
    return NextResponse.json({ error: "نوع مرفق غير صحيح" }, { status: 400 });
  }

  if (!ALLOWED_MIME_TYPES[file.type]) {
    return NextResponse.json(
      { error: "نوع الملف غير مدعوم (المسموح: JPG, PNG, WEBP, PDF)" },
      { status: 400 }
    );
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return NextResponse.json({ error: "حجم الملف أكبر من الحد المسموح (10 ميجا)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { relativePath } = await saveAttachmentFile({
    clinicId,
    visitId,
    buffer,
    mimeType: file.type,
  });

  const { rows } = await query<Attachment>(
    `INSERT INTO attachments (visit_id, file_url, file_type, original_name, mime_type, size_bytes, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [visitId, relativePath, fileType, file.name, file.type, file.size, userId]
  );

  const created = rows[0];
  return NextResponse.json(
    { data: { ...created, download_url: `/api/attachments/${created.id}/file` } },
    { status: 201 }
  );
}
