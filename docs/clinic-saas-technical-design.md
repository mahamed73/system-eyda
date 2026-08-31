# التصميم التقني التفصيلي — نظام إدارة العيادات
### Database Schema + API Design
**يُقرأ مع:** `clinic-saas-project-plan.md`

---

## 1. قاعدة البيانات الكاملة (PostgreSQL Schema)

```sql
-- ==========================================
-- 1. العيادات (Tenants)
-- ==========================================
CREATE TABLE clinics (
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
CREATE TABLE users (
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
CREATE INDEX idx_users_clinic ON users(clinic_id);

-- ==========================================
-- 3. المرضى
-- ==========================================
CREATE TABLE patients (
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
CREATE INDEX idx_patients_clinic ON patients(clinic_id);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_patients_name_search ON patients USING gin (full_name gin_trgm_ops);

-- ==========================================
-- 4. المواعيد
-- ==========================================
CREATE TABLE appointments (
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
CREATE INDEX idx_appointments_clinic_date ON appointments(clinic_id, scheduled_at);
-- منع تعارض الحجز على مستوى التطبيق (Application-level check) قبل الـ insert

-- ==========================================
-- 5. الزيارات / الكشوفات
-- ==========================================
CREATE TABLE visits (
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
CREATE INDEX idx_visits_patient ON visits(patient_id);
CREATE INDEX idx_visits_clinic_date ON visits(clinic_id, visit_date);

-- ==========================================
-- 6. المدفوعات
-- ==========================================
CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    amount          NUMERIC(10,2) NOT NULL,
    method          VARCHAR(20) CHECK (method IN ('cash','vodafone_cash','instapay','other')),
    paid_at         TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 7. المرفقات الطبية
-- ==========================================
CREATE TABLE attachments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visit_id        UUID NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    file_url        TEXT NOT NULL,
    file_type       VARCHAR(20) CHECK (file_type IN ('xray','lab','prescription_scan','other')),
    uploaded_at     TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 8. المخزون
-- ==========================================
CREATE TABLE inventory_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    quantity        INT NOT NULL DEFAULT 0,
    unit            VARCHAR(50) DEFAULT 'قطعة',
    min_threshold   INT DEFAULT 5,
    unit_price      NUMERIC(10,2),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_inventory_clinic ON inventory_items(clinic_id);

CREATE TABLE inventory_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    change_qty      INT NOT NULL,          -- موجب = إضافة، سالب = استهلاك
    reason          VARCHAR(255),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- 9. المصروفات
-- ==========================================
CREATE TABLE expenses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    description     VARCHAR(255) NOT NULL,
    category        VARCHAR(50), -- إيجار | فواتير | مستلزمات | صيانة | أخرى
    amount          NUMERIC(10,2) NOT NULL,
    expense_date    DATE DEFAULT CURRENT_DATE,
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_expenses_clinic_date ON expenses(clinic_id, expense_date);
```

### ملاحظات على الـ Schema
- كل جدول (ما عدا `clinics`) فيه `clinic_id` — ده أساس الـ Multi-tenancy. أي Query لازم يتفلتر بيه إجباريًا (Row Level Security في Supabase تقدر تفعّلها هنا).
- استخدمنا `gin_trgm_ops` على اسم المريض عشان البحث السريع يشتغل حتى لو الاسم مكتوب جزء منه فقط.
- منع تعارض المواعيد (Double booking) بيتحقق منه في كود التطبيق (Backend) قبل الـ INSERT، مش في قاعدة البيانات نفسها — أسهل في التعامل مع مدة الكشف المتغيرة.

---

## 2. الصلاحيات (Row Level Security — لو Supabase)

```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinic_isolation_patients" ON patients
    USING (clinic_id = current_setting('app.current_clinic_id')::uuid);

-- نفس المنطق يتكرر على: appointments, visits, payments,
-- attachments, inventory_items, inventory_movements, expenses
```

هيتم تمرير `current_clinic_id` من الـ session بعد تسجيل الدخول، عشان كل عيادة تشوف بياناتها بس.

---

## 3. الـ API Endpoints الأساسية

### Auth
```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
```

### Appointments
```
GET    /api/appointments?date=2026-08-13
POST   /api/appointments
PATCH  /api/appointments/:id          -- تعديل/تغيير حالة
DELETE /api/appointments/:id
GET    /api/appointments/check-conflict?doctor_id=&datetime=&duration=
```

### Patients
```
GET    /api/patients?search=
POST   /api/patients
GET    /api/patients/:id              -- يشمل سجل الزيارات
PATCH  /api/patients/:id
```

### Visits
```
POST   /api/visits                    -- إنشاء زيارة جديدة (كشف)
GET    /api/visits/:id
PATCH  /api/visits/:id
POST   /api/visits/:id/attachments
POST   /api/visits/:id/payments
```

### Financial Reports
```
GET    /api/reports/revenue?from=&to=
GET    /api/reports/expenses?from=&to=
GET    /api/reports/summary?period=daily|weekly|monthly
```

### Inventory
```
GET    /api/inventory
POST   /api/inventory
PATCH  /api/inventory/:id
POST   /api/inventory/:id/movements
GET    /api/inventory/low-stock       -- الأصناف تحت الحد الأدنى
```

### Expenses
```
GET    /api/expenses?from=&to=
POST   /api/expenses
```

---

## 4. تسلسل بناء الموديولات المقترح لـ Claude Code (Build Order)

1. `clinics` + `users` + Auth + Multi-tenancy middleware
2. `patients` (CRUD + بحث)
3. `appointments` (تقويم + منع تعارض)
4. `visits` + `payments` (الكشف والدفع)
5. `attachments` (رفع الملفات)
6. `inventory_items` + `inventory_movements`
7. `expenses` + `reports` (التقارير المالية المجمّعة)

كل بند فوق = جلسة/Prompt منفصلة مع Claude Code، مع Migration واضح وTest بسيط قبل الانتقال للي بعده.

---

*نهاية ملف التصميم التقني.*
