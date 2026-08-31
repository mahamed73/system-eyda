import { randomUUID } from "crypto";
import path from "path";
import { mkdir, unlink, writeFile } from "fs/promises";

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/**
 * جذر تخزين المرفقات — عمدًا برّه public/ عشان محدش يقدر يفتح ملف
 * مريض مباشرة بمجرد تخمين اللينك. القراءة بتتم فقط عبر
 * GET /api/attachments/:id/file بعد التحقق من الجلسة والعيادة.
 */
function storageRoot() {
  return path.join(process.cwd(), "storage", "uploads");
}

export function resolveAttachmentPath(relativePath: string) {
  return path.join(storageRoot(), relativePath);
}

/**
 * بيحفظ ملف مرفق على القرص تحت storage/uploads/<clinicId>/<visitId>/<uuid>.<ext>
 * وبيرجّع المسار النسبي (اللي هيتخزن في عمود file_url بقاعدة البيانات).
 */
export async function saveAttachmentFile(params: {
  clinicId: string;
  visitId: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ relativePath: string }> {
  const extension = ALLOWED_MIME_TYPES[params.mimeType];
  if (!extension) {
    throw new Error("نوع الملف غير مدعوم");
  }

  const dir = path.join(/* turbopackIgnore: true */ storageRoot(), params.clinicId, params.visitId);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  const absolutePath = path.join(dir, filename);
  await writeFile(absolutePath, params.buffer);

  return { relativePath: path.join(params.clinicId, params.visitId, filename) };
}

export async function deleteAttachmentFile(relativePath: string) {
  try {
    await unlink(/* turbopackIgnore: true */ resolveAttachmentPath(relativePath));
  } catch {
    // الملف ممكن يكون اتمسح قبل كده — تجاهل الخطأ
  }
}
