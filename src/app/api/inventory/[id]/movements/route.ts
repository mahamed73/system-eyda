import { NextResponse } from "next/server";
import { query, withTransaction } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { inventoryMovementInputSchema } from "@/lib/inventory/schema";
import type { InventoryItemWithStatus, InventoryMovement } from "@/lib/inventory/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SELECT_WITH_STATUS = `
  SELECT *, (quantity <= min_threshold) AS is_low_stock
  FROM inventory_items
`;

/**
 * GET /api/inventory/:id/movements
 * سجل حركات صنف معيّن (تاريخي)، الأحدث أولاً.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const itemCheck = await query(`SELECT id FROM inventory_items WHERE id = $1 AND clinic_id = $2`, [
    id,
    clinicId,
  ]);
  if (itemCheck.rows.length === 0) {
    return NextResponse.json({ error: "الصنف غير موجود" }, { status: 404 });
  }

  const { rows } = await query<InventoryMovement>(
    `SELECT * FROM inventory_movements WHERE item_id = $1 ORDER BY created_at DESC`,
    [id]
  );

  return NextResponse.json({ data: rows });
}

/**
 * POST /api/inventory/:id/movements
 * تسجيل حركة مخزون (إضافة كمية موجب، أو سحب/استهلاك سالب)، وتحديث
 * الكمية الحالية للصنف بشكل ذري (Transaction) عشان الرقمين يفضلوا متزامنين.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId, id: userId } = sessionOrError;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const parsed = inventoryMovementInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { change_qty, reason } = parsed.data;

  try {
    const result = await withTransaction(async (client) => {
      const itemResult = await client.query<{ id: string; quantity: number }>(
        `SELECT id, quantity FROM inventory_items WHERE id = $1 AND clinic_id = $2 FOR UPDATE`,
        [id, clinicId]
      );
      const item = itemResult.rows[0];
      if (!item) {
        throw new Error("NOT_FOUND");
      }

      const newQuantity = item.quantity + change_qty;
      if (newQuantity < 0) {
        throw new Error("INSUFFICIENT_STOCK");
      }

      await client.query(`UPDATE inventory_items SET quantity = $1 WHERE id = $2`, [
        newQuantity,
        id,
      ]);

      await client.query(
        `INSERT INTO inventory_movements (item_id, change_qty, reason, created_by) VALUES ($1, $2, $3, $4)`,
        [id, change_qty, reason ?? null, userId]
      );

      return newQuantity;
    });

    void result;
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return NextResponse.json({ error: "الصنف غير موجود" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "INSUFFICIENT_STOCK") {
      return NextResponse.json({ error: "الكمية المتاحة غير كافية لهذا السحب" }, { status: 400 });
    }
    return NextResponse.json({ error: "تعذّر تسجيل حركة المخزون" }, { status: 500 });
  }

  const updated = await query<InventoryItemWithStatus>(`${SELECT_WITH_STATUS} WHERE id = $1`, [id]);
  return NextResponse.json({ data: updated.rows[0] }, { status: 201 });
}
