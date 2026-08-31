const BASE = "http://localhost:3000";

async function login(phone, password) {
  const jar = {};
  const store = (res) => {
    const setCookies = res.headers.getSetCookie?.() || [];
    setCookies.forEach((c) => { const [pair] = c.split(";"); const [k, v] = pair.split("="); jar[k] = v; });
  };
  const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  let res = await fetch(`${BASE}/login`); store(res);
  res = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } }); store(res);
  const { csrfToken } = await res.json();
  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ phone, password, csrfToken, json: "true" }), redirect: "manual",
  }); store(res);
  return {
    fetch: (path, opts = {}) => fetch(`${BASE}${path}`, { ...opts, headers: { ...(opts.headers || {}), cookie: cookieHeader(), "Content-Type": "application/json" } }),
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error("❌ FAILED: " + msg);
  console.log("✅ " + msg);
}

async function main() {
  const doctor = await login("01000000001", "Doctor@123");

  console.log("\n== 1) Health check (من غير تسجيل دخول) ==");
  let res = await fetch(`${BASE}/api/health`);
  let json = await res.json();
  assert(res.status === 200, `health status -> ${res.status}`);
  assert(json.status === "ok", "حالة التطبيق ok");
  assert(json.database === "ok", "قاعدة البيانات متصلة");

  console.log("\n== 2) تجهيز مريض بملاحظات وآخر زيارة ==");
  res = await doctor.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({
      full_name: "مريض الكشف",
      phone: "01033332222",
      age: 40,
      gender: "male",
      allergies_notes: "يتحسس من الأسبرين",
      has_chronic_disease: true,
    }),
  });
  json = await res.json();
  assert(res.status === 201, `إنشاء المريض -> ${res.status}`);
  const patientId = json.data.id;

  const doctorsRes = await doctor.fetch("/api/doctors");
  const doctorsJson = await doctorsRes.json();
  const doctorId = doctorsJson.data[0].id;

  // زيارة سابقة بتشخيص وروشتة
  res = await doctor.fetch("/api/visits", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientId,
      doctor_id: doctorId,
      diagnosis: "التهاب في الحلق",
      prescription: "مضاد حيوي 3 مرات يوميًا",
      price: 200,
    }),
  });
  json = await res.json();
  assert(res.status === 201, `إنشاء زيارة سابقة -> ${res.status}`);

  console.log("\n== 3) ملخّص وضع الكشف ==");
  res = await doctor.fetch(`/api/encounter/${patientId}`);
  json = await res.json();
  assert(res.status === 200, `encounter status -> ${res.status}`);
  const d = json.data;
  assert(d.patient.full_name === "مريض الكشف", "اسم المريض صح");
  assert(d.patient.allergies_notes === "يتحسس من الأسبرين", "الحساسية موجودة");
  assert(d.patient.has_chronic_disease === true, "المرض المزمن موجود");
  assert(d.last_visit && d.last_visit.diagnosis === "التهاب في الحلق", "آخر زيارة وتشخيصها موجودين");
  assert(d.last_visit.prescription === "مضاد حيوي 3 مرات يوميًا", "الروشتة موجودة");
  assert(d.visits_count === 1, "عدد الكشوفات = 1");
  assert(Array.isArray(d.upcoming_appointments), "فيه قائمة مواعيد قادمة");

  console.log("\n== 4) وضع الكشف لمريض غير موجود ==");
  res = await doctor.fetch("/api/encounter/00000000-0000-0000-0000-000000000000");
  assert(res.status === 404, `مريض غير موجود -> ${res.status}`);

  console.log("\n== 5) وضع الكشف من غير تسجيل دخول ==");
  res = await fetch(`${BASE}/api/encounter/${patientId}`);
  assert(res.status === 401, `من غير جلسة -> ${res.status}`);

  console.log("\n🎉 كل اختبارات وضع الكشف والـ Health check عدّت بنجاح.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
