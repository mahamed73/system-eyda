export interface InventoryItem {
  id: string;
  clinic_id: string;
  name: string;
  quantity: number;
  unit: string;
  min_threshold: number;
  unit_price: string | null;
  updated_at: string;
}

export interface InventoryItemWithStatus extends InventoryItem {
  is_low_stock: boolean;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  change_qty: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
}
