-- Migration 001: Clinics + Users (Module 1: Auth + Multi-tenancy)
-- يطابق التصميم التقني: clinic-saas-technical-design.md

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ==========================================
-- 1. العيادات (Tenants)
-- ==========================================
CREATE TABLE IF NOT EXISTS clinics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    address         TEXT,
    phone           VARCHAR(20),
    city            VARCHAR(100) DEFAULT 'المنصورة',
    subscription_status VARCHAR(20) DEFAULT 'trial', -- trial | active | suspended
    setup_fee_paid  BOOLEAN DEFAULT FALSE,
    monthly_fee     NUMERIC(10,2),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 2. المستخدمين (طبيب / سكرتارية)
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('doctor','receptionist')),
    phone           VARCHAR(20) UNIQUE NOT NULL,
    email           VARCHAR(255) UNIQUE,
    password_hash   TEXT NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id);

-- trigger بسيط لتحديث updated_at في clinics تلقائيًا
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clinics_updated_at ON clinics;
CREATE TRIGGER trg_clinics_updated_at
    BEFORE UPDATE ON clinics
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
