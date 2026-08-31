-- Migration 003: Appointments (Module 3: المواعيد — تقويم + منع تعارض)
-- يطابق التصميم التقني: clinic-saas-technical-design.md

CREATE TABLE IF NOT EXISTS appointments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES users(id),
    scheduled_at    TIMESTAMPTZ NOT NULL,
    duration_minutes INT DEFAULT 15,
    status          VARCHAR(20) DEFAULT 'booked'
                    CHECK (status IN ('booked','arrived','completed','no_show','cancelled')),
    notes           TEXT,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date ON appointments(clinic_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_date ON appointments(doctor_id, scheduled_at);
-- منع تعارض الحجز (Double booking) بيتحقق منه في كود التطبيق (Backend) قبل الـ INSERT/UPDATE،
-- مش بقيد على مستوى قاعدة البيانات — أسهل في التعامل مع مدة الكشف المتغيرة وحالات الإلغاء.
