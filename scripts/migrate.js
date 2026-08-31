/**
 * مُشغّل الـ Migrations البسيط.
 * بيقرأ ملفات db/migrations/*.sql بالترتيب الأبجدي، ويطبّق أي ملف
 * لسه ما اتسجلش في جدول schema_migrations.
 *
 * الاستخدام:
 *   node scripts/migrate.js
 */
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MIGRATIONS_DIR = path.join(__dirname, "..", "db", "migrations");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const { rows } = await client.query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.filename));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`⏭️  متجاهل (مطبّق قبل كده): ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
    console.log(`▶️  تطبيق: ${file}`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (filename) VALUES ($1)",
        [file]
      );
      await client.query("COMMIT");
      console.log(`✅ تم: ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`❌ فشل تطبيق ${file}:`, err.message);
      process.exit(1);
    }
  }

  await client.end();
  console.log("🎉 كل الـ migrations متطبّقة.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
