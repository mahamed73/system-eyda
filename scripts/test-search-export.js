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

  console.log("\n== 0) تجهيز مريض تجريبي ==");
  let res = await doctor.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({
      full_name: "سيد فاروق",
      phone: "01044445555",
      allergies_notes: "يتحسس من البنسلين",
      has_chronic_disease: true,
    }),
  });
  let json = await res.json();
  assert(res.status === 201, `إنشاء المريض -> ${res.status}`);
  const patientId = json.data.id;

  console.log("\n== 1) البحث الموحّد: مريض بالاسم ==");
  res = await doctor.fetch("/api/search?q=سيد فاروق");
  json = await res.json();
  assert(res.status === 200, `search status -> ${res.status}`);
  assert(json.data.patients.length >= 1, "المريض ظهر في نتائج البحث");
  assert(json.data.patients[0].full_name === "سيد فاروق", "اسم المريض مطابق");

  console.log("\n== 2) البحث الموحّد: بالتليفون ==");
  res = await doctor.fetch("/api/search?q=01044445555");
  json = await res.json();
  assert(json.data.patients.some((p) => p.phone === "01044445555"), "البحث بالتليفون رجّع المريض");

  console.log("\n== 3) البحث بحرفين بس أو أقل = يرجع فاضي بدون أخطاء ==");
  res = await doctor.fetch("/api/search?q=a");
  json = await res.json();
  assert(res.status === 200, `search short status -> ${res.status}`);
  assert(json.data.patients.length === 0, "نتائج فاضية للبحث القصير");

  console.log("\n== 4) البحث الموحّد: مواعيد مريض ==");
  // نعمل موعد للمريض عشان يظهر في بحث المواعيد
  const doctorsRes = await doctor.fetch("/api/doctors");
  const doctorsJson = await doctorsRes.json();
  const doctorId = doctorsJson.data[0].id;
  const apptAt = new Date(Date.now() + 30 * 86400000).toISOString();
  res = await doctor.fetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify({ patient_id: patientId, doctor_id: doctorId, scheduled_at: apptAt, visit_type: "checkup", price: 300 }),
  });
  json = await res.json();
  assert(res.status === 201, `إنشاء موعد -> ${res.status}`);
  const createdApptId = json.data.id;

  res = await doctor.fetch("/api/search?q=سيد فاروق");
  json = await res.json();
  assert(json.data.appointments.length >= 1, "الموعد ظهر في بحث المواعيد");
  const myAppt = json.data.appointments.find((a) => a.id === createdApptId);
  assert(!!myAppt, "الموعد اللي اتعمل ظهر في نتائج البحث");
  assert(myAppt.visit_type === "checkup", "نوع الزيارة ظاهر في نتيجة البحث");
  assert(Number(myAppt.price) === 300, "سعر الكشف ظاهر في نتيجة البحث");

  console.log("\n== 5) التقرير المالي JSON ==");
  res = await doctor.fetch("/api/reports/financial");
  json = await res.json();
  assert(res.status === 200, `financial status -> ${res.status}`);
  assert(typeof json.data.totals.revenue === "number", "فيه إجمالي إيرادات");
  assert(typeof json.data.totals.expenses === "number", "فيه إجمالي مصروفات");
  assert(typeof json.data.totals.net === "number", "فيه صافي ربح");
  assert(Array.isArray(json.data.daily), "فيه جدول يومي");

  console.log("\n== 6) تصدير Excel ==");
  res = await doctor.fetch("/api/reports/export?format=xlsx");
  const contentType = res.headers.get("content-type") || "";
  assert(res.status === 200, `export status -> ${res.status}`);
  assert(contentType.includes("spreadsheetml"), `نوع الملف Excel -> ${contentType}`);
  const buf = Buffer.from(await res.arrayBuffer());
  assert(buf.length > 5000, `حجم الملف معقول -> ${buf.length} bytes`);
  assert(buf.slice(0, 2).toString() === "PK", "الملف صيغة xlsx حقيقية (zip/PK)");

  console.log("\n🎉 كل اختبارات البحث والتصدير عدّت بنجاح.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
