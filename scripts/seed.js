/**
 * Seed تجريبي: عيادة واحدة + مستخدم طبيب + مستخدم سكرتارية.
 * بيانات الدخول التجريبية هتتطبع في الآخر.
 *
 * الاستخدام:
 *   node scripts/seed.js
 */
const path = require("path");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const clinicName = "عيادة الدكتور أحمد - المنصورة";
  const clinicRes = await client.query(
    `INSERT INTO clinics (name, address, phone, city, subscription_status, setup_fee_paid, monthly_fee)
     VALUES ($1, $2, $3, $4, 'trial', true, 300)
     RETURNING id`,
    [clinicName, "شارع الجمهورية، المنصورة", "0501234567", "المنصورة"]
  );
  const clinicId = clinicRes.rows[0].id;

  const doctorPasswordHash = await bcrypt.hash("Doctor@123", 10);
  const receptionPasswordHash = await bcrypt.hash("Reception@123", 10);

  await client.query(
    `INSERT INTO users (clinic_id, name, role, phone, email, password_hash)
     VALUES ($1, $2, 'doctor', $3, $4, $5)`,
    [clinicId, "د. أحمد محمود", "01000000001", "doctor@demo-clinic.test", doctorPasswordHash]
  );

  await client.query(
    `INSERT INTO users (clinic_id, name, role, phone, email, password_hash)
     VALUES ($1, $2, 'receptionist', $3, $4, $5)`,
    [clinicId, "سارة السكرتيرة", "01000000002", "reception@demo-clinic.test", receptionPasswordHash]
  );

  await client.end();

  console.log("✅ تم إنشاء بيانات تجريبية:");
  console.log(`   العيادة: ${clinicName} (id: ${clinicId})`);
  console.log("   ------------------------------------------");
  console.log("   👨‍⚕️ الطبيب:");
  console.log("      رقم الهاتف: 01000000001");
  console.log("      كلمة المرور: Doctor@123");
  console.log("   💁 السكرتارية:");
  console.log("      رقم الهاتف: 01000000002");
  console.log("      كلمة المرور: Reception@123");
}

main().catch((err) => {
  console.error("❌ فشل الـ seed:", err.message);
  process.exit(1);
});
