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
  const d = await login("01001001000", "Demo@2026");

  console.log("\n== 1) فحص الازدواجية: نفس رقم التليفون ==");
  let res = await d.fetch("/api/patients/check-duplicate?phone=01070000137");
  let json = await res.json();
  assert(res.status === 200, `check-duplicate status -> ${res.status}`);
  assert(json.data.exact_phone.length >= 1, "لاقى مريض بنفس التليفون");

  console.log("\n== 2) فحص الازدواجية: اسم قريب ==");
  res = await d.fetch("/api/patients/check-duplicate?name=محمد عبد الرحمن");
  json = await res.json();
  assert(res.status === 200, `check-duplicate name status -> ${res.status}`);
  assert(json.data.exact_phone.length >= 1 || json.data.similar_name.length >= 1, "لاقى اسم مطابق/قريب");

  console.log("\n== 3) فلاتر المرضى: مرض مزمن ==");
  res = await d.fetch("/api/patients?chronic=yes&pageSize=100");
  json = await res.json();
  assert(res.status === 200, `patients chronic status -> ${res.status}`);
  assert(json.data.every((p) => p.has_chronic_disease === true), "كل النتائج عندهم مرض مزمن");
  assert(json.data.length >= 1, "فيه نتائج");

  console.log("\n== 4) فلاتر المرضى: النوع + علامة غير نشط ==");
  res = await d.fetch("/api/patients?gender=male&pageSize=100");
  json = await res.json();
  assert(json.data.every((p) => p.gender === "male"), "كل النتائج ذكور");
  assert("is_inactive" in (json.data[0] ?? {}), "فيه حقل is_inactive");
  assert("last_visit_date" in (json.data[0] ?? {}), "فيه حقل last_visit_date");
  const inactive = json.data.filter((p) => p.is_inactive).length;
  console.log(`   (عدد غير النشطين في الذكور: ${inactive})`);

  console.log("\n== 5) فلتر نشاط المرضى ==");
  res = await d.fetch("/api/patients?activity=inactive&pageSize=100");
  json = await res.json();
  assert(json.data.every((p) => p.is_inactive === true), "كل النتائج غير نشطين");

  console.log("\n== 6) فلتر المخزون: المنخفض فقط ==");
  res = await d.fetch("/api/inventory?low_stock=1");
  json = await res.json();
  assert(json.data.every((i) => i.is_low_stock === true), "كل النتائج منخفضة المخزون");

  console.log("\n== 7) فلتر المصروفات: تصنيف ==");
  res = await d.fetch("/api/expenses?category=إيجار");
  json = await res.json();
  assert(res.status === 200, `expenses category status -> ${res.status}`);
  assert(json.data.every((e) => e.category === "إيجار"), "كل النتائج تصنيفها إيجار");
  assert(Array.isArray(json.categories), "فيه قايمة تصنيفات");

  console.log("\n== 8) فلتر المواعيد: الحالة ==");
  const today = new Date().toISOString().slice(0, 10);
  res = await d.fetch(`/api/appointments?date=${today}&status=booked`);
  json = await res.json();
  assert(json.data.every((a) => a.status === "booked"), "كل النتائج حالة booked");

  console.log("\n== 9) تاريخ المتابعة: تسجيل كشف مع تاريخ متابعة ==");
  const doctorsRes = await d.fetch("/api/doctors");
  const doctorsJson = await doctorsRes.json();
  const doctorId = doctorsJson.data[0].id;
  // ناخد مريض موجود
  const patRes = await d.fetch("/api/patients?pageSize=1");
  const patJson = await patRes.json();
  const patientId = patJson.data[0].id;
  const followDate = new Date();
  followDate.setDate(followDate.getDate() + 14);
  const followDateStr = followDate.toISOString().slice(0, 10);
  res = await d.fetch("/api/visits", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, doctor_id: doctorId, diagnosis: "فحص", follow_up_date: followDateStr, price: 200 }),
  });
  json = await res.json();
  assert(res.status === 201, `إنشاء كشف مع متابعة -> ${res.status}`);
  assert(json.data.follow_up_date === followDateStr, "تاريخ المتابعة اتسجل صح");

  console.log("\n== 10) نظام التنبيهات ==");
  res = await d.fetch("/api/notifications");
  json = await res.json();
  assert(res.status === 200, `notifications status -> ${res.status}`);
  assert(Array.isArray(json.data), "النتيجة قايمة");
  console.log(`   (عدد التنبيهات: ${json.data.length})`);
  if (json.data.length > 0) {
    assert(["high", "medium", "low"].includes(json.data[0].priority), "فيه حقل أولوية صحيح");
    assert(typeof json.data[0].title === "string" && json.data[0].title.length > 0, "فيه عنوان");
  }

  console.log("\n🎉 كل اختبارات المجموعة B و C عدّت بنجاح.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
