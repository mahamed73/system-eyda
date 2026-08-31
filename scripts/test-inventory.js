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

  console.log("\n== إنشاء صنف مخزون جديد ==");
  let res = await doctor.fetch("/api/inventory", {
    method: "POST",
    body: JSON.stringify({ name: "قفازات طبية", unit: "علبة", quantity: 10, min_threshold: 5, unit_price: 45 }),
  });
  let json = await res.json();
  assert(res.status === 201, `إنشاء الصنف -> status ${res.status}`);
  const itemId = json.data.id;
  assert(json.data.is_low_stock === false, "الصنف مش تحت الحد الأدنى (10 > 5)");

  console.log("\n== محاولة إنشاء صنف ببيانات ناقصة ==");
  res = await doctor.fetch("/api/inventory", {
    method: "POST",
    body: JSON.stringify({ name: "أ" }),
  });
  assert(res.status === 400, `رفض اسم قصير جدًا -> status ${res.status}`);

  console.log("\n== سحب كمية (استهلاك) ==");
  res = await doctor.fetch(`/api/inventory/${itemId}/movements`, {
    method: "POST",
    body: JSON.stringify({ change_qty: -3, reason: "استخدام في كشف" }),
  });
  json = await res.json();
  assert(res.status === 201, `تسجيل حركة سحب -> status ${res.status}`);
  assert(json.data.quantity === 7, `الكمية بعد السحب -> ${json.data.quantity} (متوقع 7)`);

  console.log("\n== سحب كمية أكبر من المتاح (لازم يترفض) ==");
  res = await doctor.fetch(`/api/inventory/${itemId}/movements`, {
    method: "POST",
    body: JSON.stringify({ change_qty: -100, reason: "سحب زيادة" }),
  });
  assert(res.status === 400, `رفض سحب كمية غير كافية -> status ${res.status}`);

  console.log("\n== محاولة تسجيل حركة بكمية = صفر (لازم يترفض) ==");
  res = await doctor.fetch(`/api/inventory/${itemId}/movements`, {
    method: "POST",
    body: JSON.stringify({ change_qty: 0 }),
  });
  assert(res.status === 400, `رفض حركة بقيمة صفر -> status ${res.status}`);

  console.log("\n== سحب كمية توصل للصنف تحت الحد الأدنى ==");
  res = await doctor.fetch(`/api/inventory/${itemId}/movements`, {
    method: "POST",
    body: JSON.stringify({ change_qty: -3, reason: "استهلاك إضافي" }),
  });
  json = await res.json();
  assert(json.data.quantity === 4, `الكمية بقت 4`);
  assert(json.data.is_low_stock === true, "الصنف بقى تحت الحد الأدنى (4 <= 5)");

  console.log("\n== التأكد من ظهوره في low-stock ==");
  res = await doctor.fetch("/api/inventory/low-stock");
  json = await res.json();
  assert(json.data.some((i) => i.id === itemId), "الصنف ظاهر في قائمة low-stock");

  console.log("\n== التأكد من سجل الحركات (3 حركات) ==");
  res = await doctor.fetch(`/api/inventory/${itemId}/movements`);
  json = await res.json();
  assert(json.data.length === 2, `عدد الحركات المسجلة فعليًا (الناجحة بس) -> ${json.data.length}`);

  console.log("\n== تعديل بيانات الصنف (الاسم والحد الأدنى) — من غير المساس بالكمية ==");
  res = await doctor.fetch(`/api/inventory/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ name: "قفازات طبية (لاتكس)", min_threshold: 2 }),
  });
  json = await res.json();
  assert(json.data.name === "قفازات طبية (لاتكس)", "الاسم اتعدل صح");
  assert(json.data.quantity === 4, "الكمية فضلت زي ما هي بعد تعديل البيانات (4)");
  assert(json.data.is_low_stock === false, "بعد تقليل الحد الأدنى لـ2، الصنف بقى فوق الحد");

  console.log("\n== عزل الـ Multi-tenancy: عيادة تانية ==");
  const doctor2 = await login("01099999999", "Clinic2@123");
  res = await doctor2.fetch(`/api/inventory/${itemId}`);
  assert(res.status === 404, `عيادة تانية متقدرش توصل لصنف مش بتاعها -> status ${res.status}`);

  res = await doctor2.fetch(`/api/inventory/${itemId}/movements`, {
    method: "POST",
    body: JSON.stringify({ change_qty: 5 }),
  });
  assert(res.status === 404, `عيادة تانية متقدرش تسجل حركة على صنف مش بتاعها -> status ${res.status}`);

  res = await doctor2.fetch("/api/inventory");
  json = await res.json();
  assert(!json.data.some((i) => i.id === itemId), "قائمة مخزون العيادة التانية متضمنش صنف العيادة الأولى");

  console.log("\n== وصول من غير تسجيل دخول (لازم 401) ==");
  res = await fetch(`${BASE}/api/inventory`);
  assert(res.status === 401, `طلب من غير جلسة -> status ${res.status}`);

  console.log("\n🎉 كل اختبارات موديول المخزون عدّت بنجاح.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
