import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { inventoryItemUpdateSchema } from "@/lib/inventory/schema";
import type { InventoryItemWithStatus } from "@/lib/inventory/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SELECT_WITH_STATUS = `
  SELECT *, (quantity <= min_threshold) AS is_low_stock
  FROM inventory_items
`;

/**
 * GET /api/inventory/:id
 * تفاصيل صنف واحد.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const { rows } = await query<InventoryItemWithStatus>(
    `${SELECT_WITH_STATUS} WHERE id = $1 AND clinic_id = $2`,
    [id, clinicId]
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "الصنف غير موجود" }, { status: 404 });
  }

  return NextResponse.json({ data: rows[0] });
}

/**
 * PATCH /api/inventory/:id
 * تعديل بيانات الصنف (الاسم، الوحدة، الحد الأدنى، السعر) — ملحوظة: تعديل
 * الكمية بيتم فقط عبر POST /api/inventory/:id/movements عشان يفضل فيه
 * سجل تاريخي (Audit trail) لكل تغيير في المخزون.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;
  const { id } = await params;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const parsed = inventoryItemUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const entries = Object.entries(parsed.data).filter(([, v]) => v !== undefined);
  if (entries.length === 0) {
    return NextResponse.json({ error: "مفيش بيانات للتعديل" }, { status: 400 });
  }

  const setClauses: string[] = [];
  const values: unknown[] = [];
  entries.forEach(([key, value]) => {
    values.push(value);
    setClauses.push(`${key} = $${values.length}`);
  });
  values.push(id, clinicId);

  const result = await query(
    `UPDATE inventory_items SET ${setClauses.join(", ")}
     WHERE id = $${values.length - 1} AND clinic_id = $${values.length}
     RETURNING id`,
    values
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "الصنف غير موجود" }, { status: 404 });
  }

  const updated = await query<InventoryItemWithStatus>(`${SELECT_WITH_STATUS} WHERE id = $1`, [id]);
  return NextResponse.json({ data: updated.rows[0] });
}
