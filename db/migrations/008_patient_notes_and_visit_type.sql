-- Migration 008: تحسينات المرضى والمواعيد
-- 1) هل يوجد مرض مزمن؟ (يظهر في قائمة المرضى كملاحظة هامة)
-- 2) نوع الزيارة (كشف/متابعة) وسعرها على مستوى الموعد نفسه

ALTER TABLE patients
    ADD COLUMN IF NOT EXISTS has_chronic_disease BOOLEAN;

ALTER TABLE appointments
    ADD COLUMN IF NOT EXISTS visit_type VARCHAR(20) DEFAULT 'checkup'
        CHECK (visit_type IN ('checkup', 'follow_up')),
    ADD COLUMN IF NOT EXISTS price NUMERIC(10,2);
