-- Migration 005: Attachments (Module 5: المرفقات الطبية — رفع الملفات)
-- يطابق التصميم التقني: clinic-saas-technical-design.md
--
-- ملحوظة: عمود file_url هنا بيخزن مسار داخلي نسبي (clinicId/visitId/filename)
-- مش رابط عام مباشر — الملفات بتتخزن برّه public/ وبتتقرأ فقط عبر
-- GET /api/attachments/:id/file بعد التحقق من الجلسة وملكية العيادة،
-- عشان نحافظ على خصوصية البيانات الطبية (صور أشعة/تحاليل).

CREATE TABLE IF NOT EXISTS attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    file_url        TEXT NOT NULL,
    file_type       VARCHAR(20) CHECK (file_type IN ('xray','lab','prescription_scan','other')),
    original_name   VARCHAR(255),
    mime_type       VARCHAR(100),
    size_bytes      INT,
    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_visit ON attachments(visit_id);
