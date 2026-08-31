-- Migration 004: Visits + Payments (Module 4: الكشف والدفع)
-- يطابق التصميم التقني: clinic-saas-technical-design.md

CREATE TABLE IF NOT EXISTS visits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    appointment_id  UUID REFERENCES appointments(id),
    doctor_id       UUID NOT NULL REFERENCES users(id),
    visit_date      TIMESTAMPTZ DEFAULT now(),
    diagnosis       TEXT,
    prescription    TEXT,
    price           NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visits_patient ON visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_clinic_date ON visits(clinic_id, visit_date);

CREATE TABLE IF NOT EXISTS payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    amount          NUMERIC(10,2) NOT NULL,
    method          VARCHAR(20) CHECK (method IN ('cash','vodafone_cash','instapay','other')),
    paid_at         TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_visit ON payments(visit_id);
