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

function isoAt(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  // نضمن إن التاريخ في المستقبل (بكرة) عشان مايتعارضش مع بيانات فعلية
  d.setDate(d.getDate() + 1);
  return d.toISOString();
}

async function main() {
  console.log("== تسجيل دخول الطبيب (عيادة 1) ==");
  const doctor = await login("01000000001", "Doctor@123");
  const reception = await login("01000000002", "Reception@123");

  console.log("\n== إنشاء مريضين تجريبيين ==");
  let res = await doctor.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({ full_name: "سارة محمد", phone: "01011112222" }),
  });
  let json = await res.json();
  const patientA = json.data.id;

  res = await doctor.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({ full_name: "خالد أحمد", phone: "01033334444" }),
  });
  json = await res.json();
  const patientB = json.data.id;

  console.log("\n== جلب قائمة الأطباء ==");
  res = await doctor.fetch("/api/doctors");
  json = await res.json();
  assert(json.data.length >= 1, "فيه طبيب واحد على الأقل مسجل في العيادة");
  const doctorId = json.data[0].id;

  console.log("\n== حجز موعد جديد (10:00 لمدة 30 دقيقة) ==");
  res = await doctor.fetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientA,
      doctor_id: doctorId,
      scheduled_at: isoAt(10, 0),
      duration_minutes: 30,
      notes: "كشف أول مرة",
    }),
  });
  json = await res.json();
  assert(res.status === 201, `حجز موعد -> status ${res.status}`);
  const appointmentId1 = json.data.id;

  console.log("\n== محاولة حجز موعد متعارض (10:15 خلال نفس الفترة) ==");
  res = await doctor.fetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientB,
      doctor_id: doctorId,
      scheduled_at: isoAt(10, 15),
      duration_minutes: 15,
    }),
  });
  json = await res.json();
  assert(res.status === 409, `منع التعارض (Double booking) اشتغل -> status ${res.status}`);

  console.log("\n== حجز موعد تاني في وقت غير متعارض (11:00) بواسطة السكرتارية ==");
  res = await reception.fetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientB,
      doctor_id: doctorId,
      scheduled_at: isoAt(11, 0),
      duration_minutes: 15,
    }),
  });
  json = await res.json();
  assert(res.status === 201, `السكرتارية قدرت تحجز موعد -> status ${res.status}`);
  const appointmentId2 = json.data.id;

  console.log("\n== فحص endpoint التعارض المباشر ==");
  res = await doctor.fetch(
    `/api/appointments/check-conflict?doctor_id=${doctorId}&datetime=${encodeURIComponent(isoAt(10, 10))}&duration=10`
  );
  json = await res.json();
  assert(json.hasConflict === true, "check-conflict بيرصد التعارض صح");

  res = await doctor.fetch(
    `/api/appointments/check-conflict?doctor_id=${doctorId}&datetime=${encodeURIComponent(isoAt(14, 0))}&duration=10`
  );
  json = await res.json();
  assert(json.hasConflict === false, "check-conflict بيرصد عدم التعارض صح");

  console.log("\n== محاولة حجز بمريض من عيادة تانية (لازم يترفض) ==");
  res = await doctor.fetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      patient_id: "00000000-0000-0000-0000-000000000000",
      doctor_id: doctorId,
      scheduled_at: isoAt(15, 0),
      duration_minutes: 15,
    }),
  });
  assert(res.status === 400, `مريض غير موجود -> status ${res.status}`);

  console.log("\n== جلب مواعيد اليوم (بكرة) عبر ?date= ==");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);
  res = await doctor.fetch(`/api/appointments?date=${dateStr}`);
  json = await res.json();
  assert(json.data.length >= 2, `القائمة بترجع المواعيد المحجوزة -> عدد ${json.data.length}`);

  console.log("\n== تحديث حالة الموعد (حضر -> تم الكشف) ==");
  res = await doctor.fetch(`/api/appointments/${appointmentId1}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "arrived" }),
  });
  json = await res.json();
  assert(json.data.status === "arrived", "تحديث الحالة لـ arrived اشتغل");

  res = await doctor.fetch(`/api/appointments/${appointmentId1}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "completed" }),
  });
  json = await res.json();
  assert(json.data.status === "completed", "تحديث الحالة لـ completed اشتغل");

  console.log("\n== إلغاء الموعد التاني ثم إعادة استخدام نفس الميعاد لموعد جديد ==");
  res = await doctor.fetch(`/api/appointments/${appointmentId2}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  });
  json = await res.json();
  assert(json.data.status === "cancelled", "الإلغاء اشتغل");

  res = await doctor.fetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientA,
      doctor_id: doctorId,
      scheduled_at: isoAt(11, 0),
      duration_minutes: 15,
    }),
  });
  assert(res.status === 201, "بعد الإلغاء، الموعد المتاح بقى ممكن الحجز فيه تاني");
  const appointmentId3 = json ? json.data?.id : null;
  const newAppt = await res.json();

  console.log("\n== محاولة تأجيل الموعد لوقت فيه تعارض (لازم يترفض) ==");
  res = await doctor.fetch(`/api/appointments/${newAppt.data.id}`, {
    method: "PATCH",
    body: JSON.stringify({ scheduled_at: isoAt(10, 10) }),
  });
  assert(res.status === 409, `منع التعارض شغال برضه عند التأجيل -> status ${res.status}`);

  console.log("\n== عزل الـ Multi-tenancy: عيادة تانية ==");
  const doctor2 = await login("01099999999", "Clinic2@123");
  res = await doctor2.fetch(`/api/appointments/${appointmentId1}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled" }),
  });
  assert(res.status === 404, `عيادة تانية متقدرش تعدل موعد مش بتاعها -> status ${res.status}`);

  res = await doctor2.fetch(`/api/appointments?date=${dateStr}`);
  json = await res.json();
  assert(json.data.length === 0, "عيادة تانية مالهاش مواعيد العيادة الأولى في القائمة");

  console.log("\n== حذف موعد ==");
  res = await doctor.fetch(`/api/appointments/${newAppt.data.id}`, { method: "DELETE" });
  assert(res.status === 200, `حذف الموعد -> status ${res.status}`);

  console.log("\n== وصول من غير تسجيل دخول (لازم 401) ==");
  res = await fetch(`${BASE}/api/appointments`);
  assert(res.status === 401, `طلب من غير جلسة -> status ${res.status}`);

  console.log("\n🎉 كل اختبارات موديول المواعيد عدّت بنجاح.");

  return { patientA, patientB, appointmentId1, appointmentId2 };
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
