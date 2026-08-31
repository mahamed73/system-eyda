-- Migration 007: Expenses (Module 7: المصروفات والتقارير المالية)
-- يطابق التصميم التقني: clinic-saas-technical-design.md

CREATE TABLE IF NOT EXISTS expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    description     VARCHAR(255) NOT NULL,
    category        VARCHAR(50), -- إيجار | فواتير | مستلزمات | صيانة | أخرى (نص حر، بدون قيد CHECK)
    amount          NUMERIC(10,2) NOT NULL,
    expense_date    DATE DEFAULT CURRENT_DATE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_clinic_date ON expenses(clinic_id, expense_date);
