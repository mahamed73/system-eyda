/**
 * إضافة مستخدم جديد (سكرتيرة أو طبيب إضافي) لعيادة موجودة بالفعل.
 *
 * الاستخدام:
 *   node scripts/add-staff.js \
 *     --name="اسم الموظف" \
 *     --phone="01xxxxxxxxx" \
 *     --password="كلمة-سر-قوية" \
 *     --role="receptionist"   (أو "doctor")
 *
 * لو فيه أكتر من عيادة واحدة في النظام، لازم تحدد كمان:
 *   --clinic-phone="رقم طبيب موجود في نفس العيادة" (بنستخدمه لتحديد العيادة المطلوبة)
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
  const name = args["name"];
  const phone = args["phone"];
  const password = args["password"];
  const role = args["role"] || "receptionist";
  const clinicPhone = args["clinic-phone"];

  if (!name || !phone || !password) {
    console.error("❌ محتاج تحدد: --name --phone --password (و --role اختياري، افتراضيًا receptionist)");
    process.exit(1);
  }

  if (!["doctor", "receptionist"].includes(role)) {
    console.error('❌ --role لازم يكون "doctor" أو "receptionist"');
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

  let clinicId;
  if (clinicPhone) {
    const clinicResult = await client.query("SELECT clinic_id FROM users WHERE phone = $1", [clinicPhone]);
    if (clinicResult.rows.length === 0) {
      console.error(`❌ مفيش مستخدم برقم ${clinicPhone} نقدر نلاقي العيادة بيه.`);
      await client.end();
      process.exit(1);
    }
    clinicId = clinicResult.rows[0].clinic_id;
  } else {
    const clinicsResult = await client.query("SELECT id, name FROM clinics");
    if (clinicsResult.rows.length === 0) {
      console.error("❌ مفيش أي عيادة في النظام لسه. استخدم create-clinic.js الأول.");
      await client.end();
      process.exit(1);
    }
    if (clinicsResult.rows.length > 1) {
      console.error(
        "❌ فيه أكتر من عيادة في النظام، لازم تحدد --clinic-phone برقم أي مستخدم في العيادة المطلوبة."
      );
      await client.end();
      process.exit(1);
    }
    clinicId = clinicsResult.rows[0].id;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await client.query(
    `INSERT INTO users (clinic_id, name, role, phone, password_hash) VALUES ($1, $2, $3, $4, $5)`,
    [clinicId, name, role, phone, passwordHash]
  );

  await client.end();

  const roleLabel = role === "doctor" ? "طبيب" : "سكرتارية/استقبال";
  console.log("✅ تم إنشاء المستخدم بنجاح:");
  console.log(`   الاسم: ${name}`);
  console.log(`   الدور: ${roleLabel}`);
  console.log(`   رقم الدخول: ${phone}`);
}

main().catch((err) => {
  console.error("❌ حصل خطأ:", err.message);
  process.exit(1);
});
