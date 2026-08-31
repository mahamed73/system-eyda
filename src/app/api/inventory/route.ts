import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { inventoryItemInputSchema } from "@/lib/inventory/schema";
import type { InventoryItemWithStatus } from "@/lib/inventory/types";

const SELECT_WITH_STATUS = `
  SELECT *, (quantity <= min_threshold) AS is_low_stock
  FROM inventory_items
`;

/**
 * GET /api/inventory?search=&low_stock=1
 * قائمة أصناف مخزون العيادة، مرتبة أبجديًا، مع علامة "تحت الحد الأدنى".
 * يدعم فلتر بحث بالاسم وفلتر "المنخفض فقط".
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") ?? "").trim();
  const lowStockOnly = searchParams.get("low_stock") === "1";

  const whereClauses = ["clinic_id = $1"];
  const params: unknown[] = [clinicId];
  if (search) {
    params.push(`%${search}%`);
    whereClauses.push(`name ILIKE $${params.length}`);
  }
  if (lowStockOnly) {
    whereClauses.push("quantity <= min_threshold");
  }

  const { rows } = await query<InventoryItemWithStatus>(
    `${SELECT_WITH_STATUS} WHERE ${whereClauses.join(" AND ")} ORDER BY name ASC`,
    params
  );

  return NextResponse.json({ data: rows });
}

/**
 * POST /api/inventory
 * إضافة صنف مخزون جديد للعيادة الحالية.
 */
export async function POST(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const parsed = inventoryItemInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, quantity, unit, min_threshold, unit_price } = parsed.data;

  const { rows } = await query<{ id: string }>(
    `INSERT INTO inventory_items (clinic_id, name, quantity, unit, min_threshold, unit_price)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [clinicId, name, quantity, unit, min_threshold, unit_price ?? null]
  );

  const created = await query<InventoryItemWithStatus>(`${SELECT_WITH_STATUS} WHERE id = $1`, [
    rows[0].id,
  ]);

  return NextResponse.json({ data: created.rows[0] }, { status: 201 });
}
