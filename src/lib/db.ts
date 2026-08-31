import { Pool, type QueryResultRow } from "pg";

// Pool واحد للاتصال بقاعدة البيانات، بيتشارك بين كل الـ requests.
// هنستخدمه بدل ORM عشان نفضل قريبين من الـ SQL Schema الموصوف في
// clinic-saas-technical-design.md.
declare global {
  var _pgPool: Pool | undefined;
}

export const pool: Pool =
  global._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}

/**
 * Helper بسيط لتنفيذ Query. استخدمه بدل ما تكتب pool.query مباشرة
 * عشان نقدر نضيف logging/metrics لاحقًا في مكان واحد.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
) {
  return pool.query<T>(text, params as never[]);
}

/**
 * ينفّذ مجموعة عمليات داخل Transaction واحدة (BEGIN/COMMIT/ROLLBACK).
 * مفيد لعمليات مركّبة زي "إنشاء زيارة + تسجيل دفعة أولية" في نفس الوقت.
 */
export async function withTransaction<T>(
  fn: (client: Pick<Pool, "query">) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
