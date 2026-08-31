const BASE = "http://localhost:3000";

async function login(phone, password) {
  const jar = {};
  const store = (res) => {
    const setCookies = res.headers.raw ? res.headers.raw()["set-cookie"] : res.headers.getSetCookie?.();
    (setCookies || []).forEach((c) => {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      jar[k] = v;
    });
  };
  const cookieHeader = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");

  let res = await fetch(`${BASE}/login`);
  store(res);

  res = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: cookieHeader() } });
  store(res);
  const { csrfToken } = await res.json();

  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookieHeader() },
    body: new URLSearchParams({ phone, password, csrfToken, json: "true" }),
    redirect: "manual",
  });
  store(res);

  if (res.status !== 302 && res.status !== 200) {
    throw new Error(`فشل تسجيل الدخول لـ ${phone}: ${res.status}`);
  }

  return {
    fetch: (path, opts = {}) =>
      fetch(`${BASE}${path}`, {
        ...opts,
        headers: { ...(opts.headers || {}), cookie: cookieHeader(), "Content-Type": "application/json" },
      }),
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error("❌ FAILED: " + msg);
  console.log("✅ " + msg);
}

function isoAt(hour) {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

async function main() {
  console.log("== تسجيل دخول الطبيب (عيادة 1) ==");
  const doctor = await login("01000000001", "Doctor@123");

  console.log("\n== إنشاء مريض ==");
  let res = await doctor.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({ full_name: "منى عبد الله", phone: "01055556666" }),
  });
  let json = await res.json();
  const patientId = json.data.id;

  console.log("\n== جلب الطبيب ==");
  res = await doctor.fetch("/api/doctors");
  json = await res.json();
  const doctorId = json.data[0].id;

  console.log("\n== حجز موعد للمريض ==");
  res = await doctor.fetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientId,
      doctor_id: doctorId,
      scheduled_at: isoAt(10),
      duration_minutes: 20,
    }),
  });
  json = await res.json();
  const appointmentId = json.data.id;
  assert(res.status === 201, `حجز الموعد -> status ${res.status}`);

  console.log("\n== إنشاء زيارة مرتبطة بالموعد + دفعة أولية جزئية ==");
  res = await doctor.fetch("/api/visits", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientId,
      doctor_id: doctorId,
      appointment_id: appointmentId,
      diagnosis: "التهاب بسيط في الحلق",
      prescription: "مضاد حيوي 5 أيام",
      price: 200,
      initial_payment: { amount: 100, method: "cash" },
    }),
  });
  json = await res.json();
  assert(res.status === 201, `إنشاء الزيارة -> status ${res.status}`);
  const visitId = json.data.id;
  assert(Number(json.data.total_paid) === 100, "الدفعة الأولية اتسجلت صح (100)");
  assert(json.data.remaining_balance === 100, "المتبقي اتحسب صح (100)");

  console.log("\n== التأكد إن الموعد اتحول لـ completed تلقائيًا ==");
  res = await doctor.fetch(`/api/appointments?date=${isoAt(10).slice(0, 10)}`);
  json = await res.json();
  const appt = json.data.find((a) => a.id === appointmentId);
  assert(appt.status === "completed", `حالة الموعد بعد ربطه بزيارة -> ${appt.status}`);

  console.log("\n== محاولة إنشاء زيارة بمريض غير موجود في العيادة (لازم يترفض) ==");
  res = await doctor.fetch("/api/visits", {
    method: "POST",
    body: JSON.stringify({
      patient_id: "00000000-0000-0000-0000-000000000000",
      doctor_id: doctorId,
      price: 100,
    }),
  });
  assert(res.status === 400, `مريض غير موجود -> status ${res.status}`);

  console.log("\n== تسجيل دفعة تانية (المبلغ المتبقي) ==");
  res = await doctor.fetch(`/api/visits/${visitId}/payments`, {
    method: "POST",
    body: JSON.stringify({ amount: 100, method: "vodafone_cash" }),
  });
  json = await res.json();
  assert(res.status === 201, `تسجيل الدفعة الثانية -> status ${res.status}`);
  assert(Number(json.data.total_paid) === 200, "إجمالي المدفوع بقى 200 بعد الدفعة التانية");
  assert(json.data.remaining_balance === 0, "المتبقي بقى صفر");
  assert(json.data.payments.length === 2, "فيه دفعتين مسجلين على نفس الزيارة");

  console.log("\n== محاولة دفعة بمبلغ سالب (لازم يترفض) ==");
  res = await doctor.fetch(`/api/visits/${visitId}/payments`, {
    method: "POST",
    body: JSON.stringify({ amount: -50, method: "cash" }),
  });
  assert(res.status === 400, `رفض مبلغ سالب -> status ${res.status}`);

  console.log("\n== تعديل بيانات الزيارة (تعديل التشخيص) ==");
  res = await doctor.fetch(`/api/visits/${visitId}`, {
    method: "PATCH",
    body: JSON.stringify({ diagnosis: "تحديث: التهاب حاد" }),
  });
  json = await res.json();
  assert(json.data.diagnosis === "تحديث: التهاب حاد", "تعديل التشخيص اشتغل");
  assert(Number(json.data.total_paid) === 200, "المدفوعات لسه موجودة بعد التعديل");

  console.log("\n== التأكد إن سجل الزيارات ظاهر في ملف المريض ==");
  res = await doctor.fetch(`/api/patients/${patientId}`);
  json = await res.json();
  assert(json.data.visits.length === 1, "ملف المريض فيه زيارة واحدة مسجلة");
  assert(json.data.visits[0].id === visitId, "الزيارة المسجلة هي نفسها");
  assert(Number(json.data.visits[0].total_paid) === 200, "إجمالي المدفوع ظاهر صح في سجل المريض");

  console.log("\n== عزل الـ Multi-tenancy: عيادة تانية ==");
  const doctor2 = await login("01099999999", "Clinic2@123");
  res = await doctor2.fetch(`/api/visits/${visitId}`);
  assert(res.status === 404, `عيادة تانية متقدرش توصل لزيارة مش بتاعتها -> status ${res.status}`);

  res = await doctor2.fetch(`/api/visits/${visitId}/payments`, {
    method: "POST",
    body: JSON.stringify({ amount: 50, method: "cash" }),
  });
  assert(res.status === 404, `عيادة تانية متقدرش تسجل دفعة على زيارة مش بتاعتها -> status ${res.status}`);

  console.log("\n== وصول من غير تسجيل دخول (لازم 401) ==");
  res = await fetch(`${BASE}/api/visits`, { method: "POST", body: "{}" });
  assert(res.status === 401, `طلب من غير جلسة -> status ${res.status}`);

  console.log("\n🎉 كل اختبارات موديول الزيارات والمدفوعات عدّت بنجاح.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
