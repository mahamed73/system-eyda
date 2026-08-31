/**
 * تشغيل PostgreSQL محلي داخل الـ sandbox من غير apt (embedded-postgres).
 * البيانات بتتخزن في `.pgdata/` جوه المشروع (مضاف لـ .gitignore).
 *
 * الاستخدام:
 *   node scripts/dev-postgres.js          # يجهّز ويشغّل ويقعد شغال (استخدمه في background)
 *   node scripts/dev-postgres.js setup    # يجهّز ويشغّل وينشئ الداتابيز ويقفل (للأتمتة)
 */
const path = require("path");
const fs = require("fs");

async function main() {
  const EmbeddedPostgres = (await import("embedded-postgres")).default;

  const dataDir = path.join(__dirname, "..", ".pgdata");
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "clinic_app",
    password: "clinic_app_pw",
    port: 5432,
    persistent: true,
    // locale UTF-8 ضروري: في locale=C الـ pg_trgm بيتجاهل الحروف العربية
    // (بيعتبرها مش حروف أبجدية) فالبحث بالتقارب بيفشل للأسماء العربية.
    initdbFlags: ["--locale=C.UTF-8", "--encoding=UTF8"],
    postgresFlags: [],
  });

  const mode = process.argv[2] || "serve";

  if (!fs.existsSync(dataDir) || !fs.readdirSync(dataDir).length) {
    console.log("▶️  initialise (أول مرة)...");
    await pg.initialise();
  }

  console.log("▶️  start postgres...");
  await pg.start();

  // إنشاء الداتابيز لو مش موجودة
  const { Client } = require("pg");
  const admin = new Client({
    host: "localhost",
    port: 5432,
    user: "clinic_app",
    password: "clinic_app_pw",
    database: "postgres",
  });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname='clinic_saas'");
  if (exists.rowCount === 0) {
    await admin.query("CREATE DATABASE clinic_saas OWNER clinic_app");
    console.log("✅ تم إنشاء قاعدة البيانات clinic_saas");
  }
  await admin.end();

  const app = new Client({
    host: "localhost",
    port: 5432,
    user: "clinic_app",
    password: "clinic_app_pw",
    database: "clinic_saas",
  });
  await app.connect();
  await app.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
  await app.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  await app.end();
  console.log("✅ الإضافات pgcrypto + pg_trgm جاهزة");

  if (mode === "setup") {
    await pg.stop();
    console.log("✅ setup خلص — شغّل: node scripts/migrate.js ثم node scripts/seed.js");
    return;
  }

  console.log("🟢 Postgres شغال على localhost:5432 (data في .pgdata/) ...");
  // يفضّل شغال
  process.on("SIGTERM", async () => {
    await pg.stop();
    process.exit(0);
  });
  process.on("SIGINT", async () => {
    await pg.stop();
    process.exit(0);
  });
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
