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

async function main() {
  console.log("== تسجيل دخول الطبيب (عيادة 1) ==");
  const doctor = await login("01000000001", "Doctor@123");

  console.log("\n== إنشاء مريض جديد ==");
  let res = await doctor.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({
      full_name: "محمد إبراهيم السيد",
      phone: "01122334455",
      age: 34,
      gender: "male",
      address: "حي الجامعة، المنصورة",
      allergies_notes: "حساسية من البنسلين",
    }),
  });
  let json = await res.json();
  assert(res.status === 201, `إنشاء مريض -> status ${res.status}`);
  const patientId = json.data.id;
  assert(json.data.full_name === "محمد إبراهيم السيد", "الاسم اتخزن صح");

  console.log("\n== محاولة إنشاء مريض ببيانات ناقصة (لازم يفشل) ==");
  res = await doctor.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({ full_name: "أ", phone: "123" }),
  });
  assert(res.status === 400, `Validation بترفض بيانات غلط -> status ${res.status}`);

  console.log("\n== البحث بجزء من الاسم ==");
  res = await doctor.fetch("/api/patients?search=" + encodeURIComponent("إبراهيم"));
  json = await res.json();
  assert(json.data.some((p) => p.id === patientId), "البحث بجزء من الاسم لقى المريض");

  console.log("\n== البحث برقم التليفون ==");
  res = await doctor.fetch("/api/patients?search=01122334455");
  json = await res.json();
  assert(json.data.some((p) => p.id === patientId), "البحث برقم التليفون لقى المريض");

  console.log("\n== جلب تفاصيل المريض ==");
  res = await doctor.fetch(`/api/patients/${patientId}`);
  json = await res.json();
  assert(res.status === 200 && json.data.age === 34, "تفاصيل المريض صحيحة");

  console.log("\n== تعديل بيانات المريض (Partial update) ==");
  res = await doctor.fetch(`/api/patients/${patientId}`, {
    method: "PATCH",
    body: JSON.stringify({ age: 35 }),
  });
  json = await res.json();
  assert(res.status === 200 && json.data.age === 35, "التعديل الجزئي اشتغل (age فقط اتغير)");
  assert(json.data.full_name === "محمد إبراهيم السيد", "باقي الحقول فضلت زي ما هي بعد partial update");

  console.log("\n== تسجيل دخول طبيبة عيادة تانية (عزل الـ Multi-tenancy) ==");
  const doctor2 = await login("01099999999", "Clinic2@123");

  res = await doctor2.fetch(`/api/patients/${patientId}`);
  assert(res.status === 404, `عيادة تانية متقدرش توصل لمريض مش بتاعها -> status ${res.status}`);

  res = await doctor2.fetch("/api/patients");
  json = await res.json();
  assert(
    !json.data.some((p) => p.id === patientId),
    "قائمة مرضى العيادة التانية متضمنش مريض العيادة الأولى"
  );

  console.log("\n== محاولة وصول من غير تسجيل دخول (لازم 401 JSON) ==");
  res = await fetch(`${BASE}/api/patients`);
  assert(res.status === 401, `طلب من غير جلسة -> status ${res.status}`);

  console.log("\n🎉 كل اختبارات موديول المرضى عدّت بنجاح.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
