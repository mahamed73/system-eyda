/**
 * Seed النسخة التجريبية (Demo) — عيادة وهمية مليانة بيانات واقعية الشكل
 * (مرضى، مواعيد، كشوفات ومدفوعات، مخزون، مصروفات) عشان العميل المحتمل
 * يشوف النظام شغال بالكامل من غير ما ندخله بيانات حقيقية.
 *
 * Idempotent: لو العيادة التجريبية موجودة قبل كده، السكريبت بيسكيب
 * من غير ما يكرر البيانات.
 *
 * الاستخدام:
 *   node scripts/seed-demo.js
 */
const path = require("path");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const demo = require("../demo-config.json");

// ============ بيانات واقعية ============
// [الاسم, العمر, النوع, مرض مزمن, ملاحظات حساسية]
const PATIENTS = [
  ["محمد عبد الرحمن", 45, "male", true, "حساسية من البنسلين"],
  ["فاطمة السيد", 32, "female", false, "حساسية من الأسبرين"],
  ["أحمد حسن", 8, "male", false, null],
  ["سعاد إبراهيم", 58, "female", true, "سكر وضغط — متابعة دورية"],
  ["يوسف كمال", 25, "male", false, null],
  ["مريم عادل", 41, "female", true, "حساسية من السلفا"],
  ["خالد منير", 63, "male", true, null],
  ["نورهان سامي", 27, "female", false, null],
  ["عمر فتحي", 5, "male", false, "حساسية من اللبن"],
  ["هدى رشاد", 49, "female", true, null],
  ["كريم صلاح", 35, "male", false, null],
  ["آية محمود", 22, "female", false, null],
  ["حسن الشناوي", 71, "male", true, "بياخد أدوية سيولة"],
  ["رانيا طارق", 38, "female", false, null],
  ["إبراهيم عوض", 55, "male", true, "حساسية من اليود"],
];

// مواعيد: [رقم المريض, إزاحة اليوم, ساعة:دقيقة, المدة, الحالة, نوع الزيارة, السعر]
// إزاحة اليوم: 0 = النهاردة، سالب = ماضي، موجب = قادم
const APPOINTMENTS = [
  [0, 0, "10:00", 15, "completed", "checkup", 250],
  [1, 0, "10:30", 15, "completed", "follow_up", 150],
  [2, 0, "11:00", 20, "arrived", "checkup", 250],
  [3, 0, "11:30", 15, "booked", "follow_up", 150],
  [4, 0, "12:00", 15, "booked", "checkup", 250],
  [5, 0, "12:30", 15, "no_show", "follow_up", 150],
  [6, 0, "13:00", 20, "booked", "checkup", 300],
  [7, 1, "10:00", 15, "booked", "checkup", 250],
  [8, 1, "10:30", 20, "booked", "checkup", 250],
  [9, 1, "11:00", 15, "booked", "follow_up", 150],
  [10, 1, "11:30", 15, "booked", "checkup", 250],
  [11, 1, "12:00", 15, "booked", "checkup", 250],
  [12, 1, "12:30", 20, "booked", "checkup", 300],
  [13, 2, "10:00", 15, "booked", "checkup", 250],
  [14, 2, "10:30", 15, "booked", "follow_up", 150],
  [1, 3, "11:00", 15, "booked", "follow_up", 150],
  [3, 3, "11:30", 15, "booked", "follow_up", 150],
  [0, -1, "10:00", 15, "completed", "checkup", 250],
  [3, -1, "11:00", 15, "completed", "follow_up", 150],
  [9, -1, "12:00", 15, "completed", "checkup", 250],
  [6, -1, "12:30", 15, "completed", "checkup", 300],
];

// كشوفات (زيارات) مرتبطة بالمواعيد المكتملة
// [رقم المريض, التشخيص, الروشتة, السعر, المدفوع, طريقة الدفع]
const VISITS = [
  [0, "التهاب حاد في اللوزتين", "مضاد حيوي 3 مرات يوميًا لمدة 7 أيام + غرغرة", 250, 150, "cash"],
  [1, "متابعة ضغط — مستقر", "الاستمرار على نفس العلاج", 150, 150, "cash"],
  [0, "نزلة برد", "مسكن وخافض حرارة", 250, 200, "cash"],
  [3, "متابعة سكر — منتظم", "ضبط جرعة الأنسولين", 150, 100, "instapay"],
  [9, "فحص دوري — سليم", "فيتامينات عامة", 250, 250, "vodafone_cash"],
  [6, "ألم في الظهر", "جلسات علاج طبيعي + مسكن", 300, 200, "cash"],
];

// مخزون: [الاسم, الكمية, الوحدة, الحد الأدنى, سعر الوحدة]
const INVENTORY = [
  ["أمبولات مضاد حيوي", 42, "أمبولة", 10, 15],
  ["سرنجات 5 مل", 120, "قطعة", 50, 2],
  ["قفازات طبية", 300, "قطعة", 100, 1],
  ["شاش طبي", 25, "لفة", 30, 12],
  ["خافض حرارة شراب", 8, "عبوة", 15, 20],
  ["مطهر كحولي", 5, "عبوة", 10, 25],
  ["ضمادات لاصقة", 60, "علبة", 20, 18],
  ["جهاز قياس ضغط", 3, "جهاز", 2, 400],
];

// مصروفات: [الوصف, التصنيف, المبلغ, إزاحة اليوم]
const EXPENSES = [
  ["إيجار العيادة", "إيجار", 8000, 0],
  ["فاتورة الكهرباء", "فواتير", 1200, -2],
  ["فاتورة المياه", "فواتير", 350, -5],
  ["شراء مستلزمات طبية", "مستلزمات", 2500, -7],
  ["صيانة جهاز الأشعة", "صيانة", 1500, -10],
  ["راتب السكرتارية", "مرتبات", 4000, 0],
  ["اشتراك الإنترنت", "فواتير", 600, -12],
  ["دعاية وإعلان", "أخرى", 800, -15],
];

function isoAt(dayOffset, hhmm) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // ==== Idempotent: لو العيادة التجريبية موجودة، سكيب ====
  const existing = await client.query(
    "SELECT id FROM clinics WHERE phone = $1",
    [demo.clinicPhone]
  );
  if (existing.rows.length > 0) {
    console.log("⏭️  العيادة التجريبية موجودة قبل كده — مفيش حاجة جديدة.");
    await client.end();
    return;
  }

  // ==== 1) العيادة والمستخدمين ====
  const clinicRes = await client.query(
    `INSERT INTO clinics (name, address, phone, city, subscription_status, setup_fee_paid, monthly_fee)
     VALUES ($1, $2, $3, $4, 'trial', true, 300) RETURNING id`,
    [demo.clinicName, demo.clinicAddress, demo.clinicPhone, demo.clinicCity]
  );
  const clinicId = clinicRes.rows[0].id;

  // تفعيل الحجز الأونلاين افتراضيًا في العيادة التجريبية
  await client.query(
    `UPDATE clinics
       SET booking_slug = 'clinic1',
           online_booking_enabled = true,
           booking_slot_minutes = 30,
           work_start_time = '16:00',
           work_end_time = '23:00'
     WHERE id = $1`,
    [clinicId]
  );

  const docHash = await bcrypt.hash(demo.doctorPassword, 10);
  const recHash = await bcrypt.hash(demo.receptionistPassword, 10);

  const docRes = await client.query(
    `INSERT INTO users (clinic_id, name, role, phone, email, password_hash)
     VALUES ($1, $2, 'doctor', $3, $4, $5) RETURNING id`,
    [clinicId, demo.doctorName, demo.doctorPhone, "demo-doctor@easychat.cloud", docHash]
  );
  const doctorId = docRes.rows[0].id;

  await client.query(
    `INSERT INTO users (clinic_id, name, role, phone, email, password_hash)
     VALUES ($1, $2, 'receptionist', $3, $4, $5)`,
    [clinicId, demo.receptionistName, demo.receptionistPhone, "demo-reception@easychat.cloud", recHash]
  );

  // ==== 2) المرضى ====
  const patientIds = [];
  for (const [name, age, gender, chronic, notes] of PATIENTS) {
    const phone = "010" + String(70000000 + patientIds.length * 137);
    const res = await client.query(
      `INSERT INTO patients (clinic_id, full_name, phone, age, gender, allergies_notes, has_chronic_disease)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [clinicId, name, phone, age, gender, notes, chronic]
    );
    patientIds.push(res.rows[0].id);
  }

  // ==== 3) المواعيد ====
  const appointmentRows = [];
  for (const [pi, dayOff, hhmm, dur, status, vType, price] of APPOINTMENTS) {
    const res = await client.query(
      `INSERT INTO appointments (clinic_id, patient_id, doctor_id, scheduled_at, duration_minutes, status, visit_type, price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [clinicId, patientIds[pi], doctorId, isoAt(dayOff, hhmm), dur, status, vType, price]
    );
    appointmentRows.push({ id: res.rows[0].id, patientIdx: pi });
  }

  // ==== 4) الكشوفات والمدفوعات (مربوطة بمواعيد مكتملة) ====
  for (const [pi, diagnosis, prescription, price, paid, method] of VISITS) {
    // نربط الكشف بموعد مكتمل لنفس المريض عشان توزيع الإيرادات حسب
    // نوع الخدمة (كشف/متابعة) يظهر بشكل واقعي.
    const apptRes = await client.query(
      `SELECT id FROM appointments
       WHERE clinic_id = $1 AND patient_id = $2 AND status = 'completed'
       ORDER BY scheduled_at DESC LIMIT 1`,
      [clinicId, patientIds[pi]]
    );
    const appointmentId = apptRes.rows[0]?.id ?? null;

    const visitRes = await client.query(
      `INSERT INTO visits (clinic_id, patient_id, appointment_id, doctor_id, visit_date, diagnosis, prescription, price)
       VALUES ($1, $2, $3, $4, now() - ($5 || ' days')::interval, $6, $7, $8) RETURNING id`,
      [clinicId, patientIds[pi], appointmentId, doctorId, pi, diagnosis, prescription, price]
    );
    const visitId = visitRes.rows[0].id;
    await client.query(
      `INSERT INTO payments (visit_id, amount, method, paid_at)
       VALUES ($1, $2, $3, now() - ($4 || ' days')::interval)`,
      [visitId, paid, method, pi]
    );
  }

  // ==== 4b) زيارات قديمة (مرضى غائبين) لحملة الاستعادة ====
  // [رقم المريض, التشخيص, السعر, إزاحة الأيام (أكتر من 180 = غائب)]
  const OLD_VISITS = [
    [10, "التهاب في الحلق", 250, 210],
    [11, "فحص عام", 250, 240],
    [12, "ارتفاع ضغط", 300, 200],
    [13, "أنيميا", 250, 260],
    [14, "سكر", 300, 190],
  ];
  for (const [pi, diagnosis, price, daysAgo] of OLD_VISITS) {
    const vRes = await client.query(
      `INSERT INTO visits (clinic_id, patient_id, doctor_id, visit_date, diagnosis, price)
       VALUES ($1, $2, $3, now() - ($4 || ' days')::interval, $5, $6) RETURNING id`,
      [clinicId, patientIds[pi], doctorId, daysAgo, diagnosis, price]
    );
    await client.query(
      `INSERT INTO payments (visit_id, amount, method, paid_at)
       VALUES ($1, $2, 'cash', now() - ($3 || ' days')::interval)`,
      [vRes.rows[0].id, price, daysAgo]
    );
  }

  // ==== 5) المخزون ====
  for (const [name, qty, unit, min, price] of INVENTORY) {
    await client.query(
      `INSERT INTO inventory_items (clinic_id, name, quantity, unit, min_threshold, unit_price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [clinicId, name, qty, unit, min, price]
    );
  }

  // ==== 6) المصروفات ====
  for (const [desc, cat, amount, dayOff] of EXPENSES) {
    await client.query(
      `INSERT INTO expenses (clinic_id, description, category, amount, expense_date)
       VALUES ($1, $2, $3, $4, CURRENT_DATE + ($5)::int)`,
      [clinicId, desc, cat, amount, dayOff]
    );
  }

  await client.end();

  console.log("✅ تم إنشاء النسخة التجريبية بنجاح:");
  console.log(`   العيادة: ${demo.clinicName} — ${demo.clinicCity}`);
  console.log(`   ${PATIENTS.length} مريض | ${APPOINTMENTS.length} موعد | ${VISITS.length} كشف | ${INVENTORY.length} صنف مخزون | ${EXPENSES.length} مصروف`);
  console.log("   ------------------------------------------");
  console.log(`   👨‍⚕️ الطبيب: ${demo.doctorPhone} / ${demo.doctorPassword}`);
  console.log(`   💁 السكرتارية: ${demo.receptionistPhone} / ${demo.receptionistPassword}`);
}

main().catch((err) => {
  console.error("❌ فشل seed الديمو:", err.message);
  process.exit(1);
});
