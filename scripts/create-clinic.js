/**
 * إنشاء عيادة حقيقية + حساب طبيب أول (للاستخدام في الإنتاج، بدل
 * بيانات seed.js التجريبية).
 *
 * الاستخدام:
 *   node scripts/create-clinic.js \
 *     --clinic-name="عيادة د. فلان" \
 *     --city="المنصورة" \
 *     --doctor-name="د. فلان الفلاني" \
 *     --phone="01xxxxxxxxx" \
 *     --password="كلمة-سر-قوية"
 *
 * أو داخل الـ container على السيرفر:
 *   docker compose exec app node scripts/create-clinic.js --clinic-name="..." ...
 */
const path = require("path");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const clinicName = args["clinic-name"];
  const city = args["city"] || "المنصورة";
  const doctorName = args["doctor-name"];
  const phone = args["phone"];
  const password = args["password"];

  if (!clinicName || !doctorName || !phone || !password) {
    console.error(
      "❌ محتاج تحدد: --clinic-name --doctor-name --phone --password (و --city اختياري)"
    );
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("❌ كلمة السر لازم تكون 8 حروف/أرقام على الأقل.");
    process.exit(1);
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const existingPhone = await client.query("SELECT id FROM users WHERE phone = $1", [phone]);
  if (existingPhone.rows.length > 0) {
    console.error(`❌ رقم الهاتف ${phone} مسجّل قبل كده لمستخدم تاني.`);
    await client.end();
    process.exit(1);
  }

  const clinicResult = await client.query(
    `INSERT INTO clinics (name, city, subscription_status, setup_fee_paid)
     VALUES ($1, $2, 'active', true)
     RETURNING id`,
    [clinicName, city]
  );
  const clinicId = clinicResult.rows[0].id;

  const passwordHash = await bcrypt.hash(password, 10);
  await client.query(
    `INSERT INTO users (clinic_id, name, role, phone, password_hash)
     VALUES ($1, $2, 'doctor', $3, $4)`,
    [clinicId, doctorName, phone, passwordHash]
  );

  await client.end();

  console.log("✅ تم إنشاء العيادة والطبيب بنجاح:");
  console.log(`   العيادة: ${clinicName} (${city})`);
  console.log(`   الطبيب: ${doctorName}`);
  console.log(`   رقم الدخول: ${phone}`);
  console.log("   دلوقتي يقدر يسجّل دخول بالرقم وكلمة السر اللي حددتها.");
}

main().catch((err) => {
  console.error("❌ حصل خطأ:", err.message);
  process.exit(1);
});
