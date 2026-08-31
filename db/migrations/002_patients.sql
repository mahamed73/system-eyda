-- Migration 002: Patients (Module 2: ملفات المرضى — CRUD + بحث)
-- يطابق التصميم التقني: clinic-saas-technical-design.md

CREATE TABLE IF NOT EXISTS patients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    full_name       VARCHAR(255) NOT NULL,
    phone           VARCHAR(20) NOT NULL,
    age             INT,
    gender          VARCHAR(10) CHECK (gender IN ('male','female')),
    address         TEXT,
    allergies_notes TEXT,          -- ملاحظات حساسية/أمراض مزمنة
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patients_clinic ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_name_search ON patients USING gin (full_name gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_patients_updated_at ON patients;
CREATE TRIGGER trg_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
