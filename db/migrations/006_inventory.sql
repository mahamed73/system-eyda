-- Migration 006: Inventory (Module 6: المخزون)
-- يطابق التصميم التقني: clinic-saas-technical-design.md

CREATE TABLE IF NOT EXISTS inventory_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    quantity        INT NOT NULL DEFAULT 0,
    unit            VARCHAR(50) DEFAULT 'قطعة',
    min_threshold   INT DEFAULT 5,
    unit_price      NUMERIC(10,2),
    updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_clinic ON inventory_items(clinic_id);

DROP TRIGGER IF EXISTS trg_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER trg_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS inventory_movements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    change_qty      INT NOT NULL,          -- موجب = إضافة، سالب = استهلاك
    reason          VARCHAR(255),
    created_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON inventory_movements(item_id);
