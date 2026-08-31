import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";
import { expenseInputSchema } from "@/lib/expenses/schema";
import type { Expense } from "@/lib/expenses/types";

function defaultDateRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

/**
 * GET /api/expenses?from=&to=
 * قائمة مصروفات العيادة في فترة معيّنة (افتراضيًا آخر 30 يوم).
 */
export async function GET(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId } = sessionOrError;

  const { searchParams } = new URL(request.url);
  const defaults = defaultDateRange();
  const from = searchParams.get("from") ?? defaults.from;
  const to = searchParams.get("to") ?? defaults.to;
  const category = searchParams.get("category")?.trim();

  const whereClauses = ["clinic_id = $1", "expense_date BETWEEN $2 AND $3"];
  const params: unknown[] = [clinicId, from, to];
  if (category) {
    params.push(category);
    whereClauses.push(`category = $${params.length}`);
  }

  const { rows } = await query<Expense>(
    `SELECT * FROM expenses
     WHERE ${whereClauses.join(" AND ")}
     ORDER BY expense_date DESC, created_at DESC`,
    params
  );

  const total = rows.reduce((sum, e) => sum + Number(e.amount), 0);

  // قايمة التصنيفات الموجودة (للفلتر) — بترجع دايماً
  const categoriesRes = await query<{ category: string }>(
    `SELECT DISTINCT category FROM expenses
     WHERE clinic_id = $1 AND category IS NOT NULL AND category <> ''
     ORDER BY category ASC`,
    [clinicId]
  );

  return NextResponse.json({
    data: rows,
    total,
    from,
    to,
    categories: categoriesRes.rows.map((r) => r.category),
  });
}

/**
 * POST /api/expenses
 * تسجيل مصروف جديد للعيادة.
 */
export async function POST(request: Request) {
  const sessionOrError = await requireSession();
  if (sessionOrError instanceof NextResponse) return sessionOrError;
  const { clinicId, id: userId } = sessionOrError;

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "بيانات غير صحيحة" }, { status: 400 });
  }

  const parsed = expenseInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "بيانات غير صحيحة", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { description, category, amount, expense_date } = parsed.data;

  const { rows } = await query<Expense>(
    `INSERT INTO expenses (clinic_id, description, category, amount, expense_date, created_by)
     VALUES ($1, $2, $3, $4, COALESCE($5, CURRENT_DATE), $6)
     RETURNING *`,
    [clinicId, description, category ?? null, amount, expense_date ?? null, userId]
  );

  return NextResponse.json({ data: rows[0] }, { status: 201 });
}
