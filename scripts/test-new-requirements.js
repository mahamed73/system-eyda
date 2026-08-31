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

function isoAt(hour) {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  console.log("== تسجيل دخول الطبيب ==");
  const doctor = await login("01000000001", "Doctor@123");

  console.log("\n== 1) إنشاء مريض بملاحظة هامة ومرض مزمن ==");
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
  assert(json.data.has_chronic_disease === true, "has_chronic_disease اتسجل صح");
  assert(json.data.allergies_notes === "يتحسس من البنسلين", "allergies_notes اتسجلت صح");

  console.log("\n== التأكد إن قائمة المرضى بترجع الملاحظات من غير فتح الملف ==");
  res = await doctor.fetch("/api/patients?search=سيد فاروق");
  json = await res.json();
  const listed = json.data.find((p) => p.id === patientId);
  assert(!!listed, "المريض ظاهر في القائمة");
  assert(listed.allergies_notes === "يتحسس من البنسلين", "الملاحظة ظاهرة في نتيجة القائمة نفسها");
  assert(listed.has_chronic_disease === true, "مرض مزمن ظاهر في نتيجة القائمة نفسها");

  console.log("\n== 2+3) حجز موعد بنوع 'متابعة' وسعر 250، وتحديث حالة مرض مزمن لـ false ==");
  res = await doctor.fetch("/api/doctors");
  json = await res.json();
  const doctorId = json.data[0].id;

  res = await doctor.fetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientId,
      doctor_id: doctorId,
      scheduled_at: isoAt(10),
      duration_minutes: 20,
      visit_type: "follow_up",
      price: 250,
      patient_has_chronic_disease: false,
    }),
  });
  json = await res.json();
  assert(res.status === 201, `حجز الموعد -> ${res.status}`);
  const appointmentId = json.data.id;
  assert(json.data.visit_type === "follow_up", "نوع الزيارة اتسجل صح (متابعة)");
  assert(Number(json.data.price) === 250, "السعر اتسجل صح (250)");

  console.log("\n== التأكد إن تحديث مرض مزمن أثناء الحجز فعلاً غيّر بيانات المريض ==");
  res = await doctor.fetch(`/api/patients/${patientId}`);
  json = await res.json();
  assert(json.data.has_chronic_disease === false, "has_chronic_disease اتحدّث لـ false بعد الحجز");

  console.log("\n== محاولة حجز بنوع زيارة غير صحيح (لازم يترفض) ==");
  res = await doctor.fetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientId, doctor_id: doctorId, scheduled_at: isoAt(14),
      visit_type: "something_else",
    }),
  });
  assert(res.status === 400, `رفض نوع زيارة غير صحيح -> ${res.status}`);

  console.log("\n== GET /api/appointments/:id (لصفحة تسجيل الكشف) ==");
  res = await doctor.fetch(`/api/appointments/${appointmentId}`);
  json = await res.json();
  assert(res.status === 200, `جلب الموعد -> ${res.status}`);
  assert(json.data.visit_type === "follow_up" && Number(json.data.price) === 250, "بيانات الموعد صحيحة");

  console.log("\n== 4) إنشاء زيارة مرتبطة بالموعد من غير إرسال سعر يدوي — لازم ياخد سعر الموعد (250) ==");
  res = await doctor.fetch("/api/visits", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_id: appointmentId,
      diagnosis: "متابعة دورية",
    }),
  });
  json = await res.json();
  assert(res.status === 201, `إنشاء الزيارة -> ${res.status}`);
  assert(Number(json.data.price) === 250, `السعر اتسحب تلقائيًا من الموعد -> ${json.data.price}`);

  console.log("\n== زيارة من غير موعد ومن غير سعر — لازم يبقى صفر افتراضيًا ==");
  res = await doctor.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({ full_name: "مريض واك إن", phone: "01099998888" }),
  });
  const patient2 = (await res.json()).data;

  res = await doctor.fetch("/api/visits", {
    method: "POST",
    body: JSON.stringify({ patient_id: patient2.id, doctor_id: doctorId, diagnosis: "كشف عادي" }),
  });
  json = await res.json();
  assert(res.status === 201, `زيارة بدون موعد -> ${res.status}`);
  assert(Number(json.data.price) === 0, `السعر الافتراضي صفر لما مفيش موعد ومفيش سعر مُرسل -> ${json.data.price}`);

  console.log("\n== عزل الـ Multi-tenancy لسه شغال (فحص سريع) ==");
  res = await fetch(`${BASE}/api/appointments`);
  assert(res.status === 401, `طلب من غير جلسة -> ${res.status}`);

  console.log("\n🎉 كل اختبارات التعديلات الجديدة عدّت بنجاح.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
