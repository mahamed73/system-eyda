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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  console.log("== تسجيل دخول الطبيب (عيادة 1) ==");
  const doctor = await login("01000000001", "Doctor@123");

  console.log("\n== تسجيل مصروفين ==");
  let res = await doctor.fetch("/api/expenses", {
    method: "POST",
    body: JSON.stringify({ description: "إيجار الشهر", category: "إيجار", amount: 2000, expense_date: todayStr() }),
  });
  let json = await res.json();
  assert(res.status === 201, `تسجيل مصروف 1 -> status ${res.status}`);
  const expenseId1 = json.data.id;

  res = await doctor.fetch("/api/expenses", {
    method: "POST",
    body: JSON.stringify({ description: "فاتورة كهرباء", category: "فواتير", amount: 300, expense_date: todayStr() }),
  });
  json = await res.json();
  assert(res.status === 201, `تسجيل مصروف 2 -> status ${res.status}`);

  console.log("\n== محاولة تسجيل مصروف ببيانات ناقصة ==");
  res = await doctor.fetch("/api/expenses", {
    method: "POST",
    body: JSON.stringify({ description: "أ", amount: -5 }),
  });
  assert(res.status === 400, `رفض بيانات غير صالحة -> status ${res.status}`);

  console.log("\n== جلب قائمة المصروفات والتأكد من الإجمالي ==");
  res = await doctor.fetch("/api/expenses");
  json = await res.json();
  assert(json.data.length >= 2, `فيه مصروفين على الأقل -> ${json.data.length}`);
  assert(json.total >= 2300, `الإجمالي المحسوب صحيح -> ${json.total}`);

  console.log("\n== إنشاء مريض + زيارة + دفعة (عشان تظهر في تقرير الإيرادات) ==");
  res = await doctor.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({ full_name: "ليلى كريم", phone: "01066667777" }),
  });
  json = await res.json();
  const patientId = json.data.id;

  res = await doctor.fetch("/api/doctors");
  json = await res.json();
  const doctorId = json.data[0].id;

  res = await doctor.fetch("/api/visits", {
    method: "POST",
    body: JSON.stringify({
      patient_id: patientId,
      doctor_id: doctorId,
      price: 250,
      initial_payment: { amount: 250, method: "vodafone_cash" },
    }),
  });
  json = await res.json();
  assert(res.status === 201, `إنشاء زيارة + دفعة -> status ${res.status}`);

  console.log("\n== تقرير الإيرادات ==");
  res = await doctor.fetch("/api/reports/revenue");
  json = await res.json();
  assert(res.status === 200, `تقرير الإيرادات -> status ${res.status}`);
  assert(json.data.total >= 250, `إجمالي الإيرادات يشمل الدفعة الجديدة -> ${json.data.total}`);
  assert(
    json.data.by_method.some((m) => m.method === "vodafone_cash"),
    "تفصيل الإيرادات حسب طريقة الدفع فيه vodafone_cash"
  );

  console.log("\n== تقرير المصروفات ==");
  res = await doctor.fetch("/api/reports/expenses");
  json = await res.json();
  assert(res.status === 200, `تقرير المصروفات -> status ${res.status}`);
  assert(json.data.total >= 2300, `إجمالي المصروفات صحيح -> ${json.data.total}`);
  assert(
    json.data.by_category.some((c) => c.category === "إيجار"),
    "تفصيل المصروفات حسب التصنيف فيه إيجار"
  );

  console.log("\n== الملخص المالي (daily) — التأكد من صافي الربح ==");
  res = await doctor.fetch("/api/reports/summary?period=daily");
  json = await res.json();
  assert(res.status === 200, `ملخص يومي -> status ${res.status}`);
  const todayBucket = json.data.buckets.find((b) => b.period_start === todayStr());
  assert(!!todayBucket, "فيه bucket لليوم النهاردة");
  assert(todayBucket.revenue >= 250, `إيراد النهاردة صحيح -> ${todayBucket.revenue}`);
  assert(todayBucket.expenses >= 2300, `مصروف النهاردة صحيح -> ${todayBucket.expenses}`);
  assert(
    Math.abs(todayBucket.net - (todayBucket.revenue - todayBucket.expenses)) < 0.01,
    "صافي الربح = إيراد - مصروف"
  );

  console.log("\n== الملخص المالي (weekly/monthly) بيرجعوا بنجاح ==");
  res = await doctor.fetch("/api/reports/summary?period=weekly");
  assert(res.status === 200, "ملخص أسبوعي بيرجع 200");
  res = await doctor.fetch("/api/reports/summary?period=monthly");
  assert(res.status === 200, "ملخص شهري بيرجع 200");

  console.log("\n== محاولة period غير صحيح (لازم يترفض) ==");
  res = await doctor.fetch("/api/reports/summary?period=yearly");
  assert(res.status === 400, `رفض period غير صحيح -> status ${res.status}`);

  console.log("\n== حذف مصروف ==");
  res = await doctor.fetch(`/api/expenses/${expenseId1}`, { method: "DELETE" });
  assert(res.status === 200, `حذف المصروف -> status ${res.status}`);

  console.log("\n== عزل الـ Multi-tenancy: عيادة تانية ==");
  const doctor2 = await login("01099999999", "Clinic2@123");
  res = await doctor2.fetch("/api/expenses");
  json = await res.json();
  assert(
    !json.data.some((e) => e.description === "فاتورة كهرباء"),
    "عيادة تانية متشوفش مصروفات العيادة الأولى"
  );

  res = await doctor2.fetch(`/api/expenses/${expenseId1}`, { method: "DELETE" });
  assert(res.status === 404, `عيادة تانية متقدرش تحذف مصروف مش بتاعها -> status ${res.status}`);

  res = await doctor2.fetch("/api/reports/revenue");
  json = await res.json();
  assert(json.data.total === 0, "تقرير إيرادات العيادة التانية صفر (معزول تمامًا)");

  console.log("\n== وصول من غير تسجيل دخول (لازم 401) ==");
  res = await fetch(`${BASE}/api/reports/summary`);
  assert(res.status === 401, `طلب من غير جلسة -> status ${res.status}`);

  console.log("\n🎉 كل اختبارات موديول المصروفات والتقارير عدّت بنجاح.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
