import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import type { InventoryItemWithStatus } from "@/lib/inventory/types";

/**
 * GET /api/inventory/low-stock
 * الأصناف اللي كميتها الحالية وصلت للحد الأدنى (min_threshold) أو أقل.
 */
export async function GET() {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { rows } = await query<InventoryItemWithStatus>(
    `SELECT *, (quantity <= min_threshold) AS is_low_stock
     FROM inventory_items
     WHERE clinic_id = $1 AND quantity <= min_threshold
     ORDER BY quantity ASC`,
    [clinicId]
  );

  return NextResponse.json({ data: rows });
}
