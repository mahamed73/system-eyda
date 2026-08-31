-- Migration 010: الحجز الأونلاين + نظام الدور الذكي + شاشة الانتظار
-- + مكتبة التشخيصات + إدارة المتابعة + أداء الأطباء + فصيلة الدم

-- ============================================================
-- 1) clinics: إعدادات الحجز الأونلاين
-- ============================================================
ALTER TABLE clinics
    ADD COLUMN IF NOT EXISTS booking_slug           VARCHAR(80) UNIQUE,   -- رابط صفحة الحجز: /b/<slug>
    ADD COLUMN IF NOT EXISTS online_booking_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS booking_slot_minutes   INT DEFAULT 30,       -- مدة الموعد الواحد في الحجز العام
    ADD COLUMN IF NOT EXISTS work_start_time        TIME DEFAULT '16:00',
    ADD COLUMN IF NOT EXISTS work_end_time          TIME DEFAULT '22:00',
    ADD COLUMN IF NOT EXISTS working_days           SMALLINT[] DEFAULT '{0,1,2,3,4,5,6}', -- 0=الأحد .. 6=السبت
    ADD COLUMN IF NOT EXISTS booking_visit_types    JSONB DEFAULT
        '[{"label":"كشف","price":300},{"label":"متابعة","price":150}]'::jsonb;

-- ============================================================
-- 2) appointments: مصدر الحجز + بيانات الدور الذكي
-- ============================================================
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS booking_source VARCHAR(20) DEFAULT 'internal'
        CHECK (booking_source IN ('internal','online')),
    ADD COLUMN IF NOT EXISTS queue_number   INT,          -- رقم الدور (بيتسند عند الحضور)
    ADD COLUMN IF NOT EXISTS arrived_at     TIMESTAMPTZ,  -- وقت الحضور الفعلي
    ADD COLUMN IF NOT EXISTS started_at     TIMESTAMPTZ,  -- وقت دخول الكشف
    ADD COLUMN IF NOT EXISTS priority       SMALLINT DEFAULT 0, -- 0=عادي، 1=أولوية (حالة طارئة)
    ADD COLUMN IF NOT EXISTS booking_token  UUID DEFAULT gen_random_uuid(); -- تتبع/إلغاء ذاتي للحجز العام

-- تاريخ اليوم المحلي (بتوقيت القاهرة) — عمود محسوب لاستخدامه في فهرس رقم الدور.
-- (تعبير scheduled_at::date مش IMMUTABLE على timestamptz فمينفعش في فهرس.)
ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS local_date DATE
        GENERATED ALWAYS AS ((scheduled_at AT TIME ZONE 'Africa/Cairo')::date) STORED;

-- حالة جديدة: in_consultation (المريض جوه الكشف عند الطبيب)
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
    CHECK (status IN ('booked','arrived','in_consultation','completed','no_show','cancelled'));

-- رقم الدور فريد لكل عيادة في اليوم الواحد
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_queue_no
    ON appointments(clinic_id, local_date, queue_number)
    WHERE queue_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_booking_token
    ON appointments(booking_token);
CREATE INDEX IF NOT EXISTS idx_appointments_status_today
    ON appointments(clinic_id, status, scheduled_at);

-- ============================================================
-- 3) patients: فصيلة الدم
-- ============================================================
ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS blood_type VARCHAR(5)
    CHECK (blood_type IS NULL OR blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-'));

-- ============================================================
-- 4) مكتبة التشخيصات المتكررة (Diagnosis Library)
-- ============================================================
CREATE TABLE IF NOT EXISTS diagnosis_library (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id    UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    doctor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    title        VARCHAR(255) NOT NULL,        -- اسم مختصر يظهر في القائمة
    diagnosis    TEXT,                          -- نص التشخيص الجاهز
    prescription TEXT,                          -- روشتة جاهزة (اختياري)
    usage_count  INT NOT NULL DEFAULT 0,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_diagnosis_library_clinic
    ON diagnosis_library(clinic_id, is_active, usage_count DESC);

-- ============================================================
-- 5) المتابعات: نتيجة المتابعة + علامة الإتمام
-- ============================================================
ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS follow_up_result    TEXT,
    ADD COLUMN IF NOT EXISTS follow_up_completed BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_visits_followup
    ON visits(clinic_id, follow_up_date)
    WHERE follow_up_date IS NOT NULL;
