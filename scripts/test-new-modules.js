/**
 * اختبار تكاملي للموديولات الجديدة (Migration 010):
 *  1) الحجز الأونلاين (slots + إنشاء حجز + متابعة برقم token)
 *  2) نظام الدور الذكي (حضور → رقم دور → بدء كشف → شاشة الانتظار العامة)
 *  3) مكتبة التشخيصات (إضافة + استخدام + قائمة)
 *  4) المتابعات (تسجيل نتيجة/إتمام)
 *  5) تقرير أداء الأطباء
 *  6) فصيلة الدم في ملف المريض
 *
 * التشغيل: node scripts/test-new-modules.js  (والسيرفر شغال على :3000)
 */
const BASE = "http://localhost:3000";
const SLUG = "dr-khaled-nour";

async function login(phone, password) {
  const jar = {};
  const store = (res) => {
    const setCookies = res.headers.getSetCookie?.() || [];
    setCookies.forEach((c) => {
      const [pair] = c.split(";");
      const [k, v] = pair.split("=");
      jar[k] = v;
    });
  };
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
  function cookieHeader() {
    return Object.entries(jar)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
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

function futureDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const d = await login("01001001000", "Demo@2026");

  // ===== 1) صفحة الحجز العامة: بيانات العيادة =====
  console.log("\n== 1) الحجز الأونلاين: بيانات العيادة والفتحات ===");
  let res = await fetch(`${BASE}/api/public/book/${SLUG}?date=${futureDate(2)}`);
  let json = await res.json();
  assert(res.status === 200, `بيانات العيادة العامة -> ${res.status}`);
  assert(json.data.name.includes("خالد"), "اسم العيادة رجع صح");
  assert(Array.isArray(json.data.slots), "الفتحات مصفوفة");
  assert(json.data.visit_types.length >= 2, "أنواع الزيارة راجعة (كشف/متابعة)");

  // slug غلط -> 404
  res = await fetch(`${BASE}/api/public/book/does-not-exist`);
  assert(res.status === 404, `عيادة بـ slug غلط -> 404 (طلع ${res.status})`);

  // ===== 2) إنشاء حجز أونلاين =====
  console.log("\n== 2) إنشاء حجز أونلاين جديد ===");
  const slot = json.data.slots[0];
  assert(!!slot, "فيه فتحة فاضية نحجزها");
  const phone = "01088" + String(Date.now()).slice(-6);
  res = await fetch(`${BASE}/api/public/book/${SLUG}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "مريض أونلاين اختبار",
      phone,
      age: 30,
      gender: "male",
      visit_label: json.data.visit_types[0].label,
      date: futureDate(2),
      time: slot,
    }),
  });
  json = await res.json();
  assert(res.status === 201, `الحجز اتعمل -> 201 (طلع ${res.status}: ${JSON.stringify(json).slice(0, 200)})`);
  const token = json.data.token;
  assert(!!token, "الحجز رجّع token متابعة");

  // متابعة الحجز بالـ token
  res = await fetch(`${BASE}/api/public/booking/${token}`);
  json = await res.json();
  assert(res.status === 200 && json.data.status === "booked", "متابعة الحجز: الحالة booked");

  // رفض بيانات ناقصة
  res = await fetch(`${BASE}/api/public/book/${SLUG}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: "x", phone: "1", visit_label: "", date: "2026-01-01", time: "10:00" }),
  });
  assert(res.status === 400, `بيانات ناقصة -> 400 (طلع ${res.status})`);

  // نفس الفتحة تاني -> 409 تعارض
  res = await fetch(`${BASE}/api/public/book/${SLUG}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: "تاني مريض",
      phone: "01077123456",
      visit_label: json.data?.visit_label || "كشف",
      date: futureDate(2),
      time: slot,
    }),
  });
  assert(res.status === 409, `حجز نفس الفتحة -> 409 تعارض (طلع ${res.status})`);

  // ===== 3) نظام الدور: حجز داخلي النهاردة + حضور =====
  console.log("\n== 3) نظام الدور الذكي ===");
  // ننشئ مريض وموعد النهاردة عبر الـ API الداخلي
  res = await d.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({
      full_name: "مريض طابور اختبار",
      phone: "01066111222",
      age: 40,
      gender: "male",
      blood_type: "O+",
    }),
  });
  json = await res.json();
  assert(res.status === 201, `مريض جديد بـ فصيلة دم -> 201 (طلع ${res.status})`);
  const patientId = json.data.id;
  assert(json.data.blood_type === "O+", "فصيلة الدم اتسجّلت O+");

  const doctorsRes = await d.fetch("/api/doctors");
  const doctorsJson = await doctorsRes.json();
  const doctorId = doctorsJson.data[0].id;

  // موعد النهاردة في فتحة فاضية — نجرّب ساعات مساء القاهرة (16:00-23:30 بتوقيت
  // القاهرة = 14:00-21:30 UTC) لأن ترقيم أيام الدور بيعتمد على توقيت القاهرة.
  let apptJson = null;
  for (let hCairo = 23; hCairo >= 16; hCairo--) {
    for (const m of [30, 0]) {
      // وقت القاهرة المحلي للنهاردة → نحوله لـ ISO
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Africa/Cairo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const cand = new Date(`${parts}T${String(hCairo).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+02:00`);
      if (cand.getTime() <= Date.now()) continue;
      const r = await d.fetch("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId,
          doctor_id: doctorId,
          scheduled_at: cand.toISOString(),
          duration_minutes: 15,
          visit_type: "checkup",
          price: 300,
        }),
      });
      const j = await r.json();
      if (r.status === 201) {
        apptJson = j;
        break;
      }
    }
    if (apptJson) break;
  }
  assert(!!apptJson, "موعد النهاردة اتعمل في فتحة فاضية -> 201");
  json = apptJson;
  const apptId = json.data.id;

  // تسجيل حضور -> رقم دور
  res = await d.fetch(`/api/queue/${apptId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "arrive" }),
  });
  json = await res.json();
  assert(res.status === 200, `تسجيل الحضور -> 200 (طلع ${res.status})`);
  assert(!!json.data.queue_number, `رقم الدور اتسند: ${json.data.queue_number}`);
  assert(json.summary.waiting_count >= 1, "الطابور فيه مريض منتظر على الأقل");

  // شاشة الانتظار العامة
  res = await fetch(`${BASE}/api/public/screen/${SLUG}`);
  json = await res.json();
  assert(res.status === 200, `شاشة الانتظار العامة -> 200 (طلع ${res.status})`);
  assert("waiting_count" in json.data, "الشاشة بتعرض عدد المنتظرين");

  // بدء الكشف
  res = await d.fetch(`/api/queue/${apptId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "start" }),
  });
  json = await res.json();
  assert(res.status === 200 && json.data.status === "in_consultation", "بدء الكشف -> in_consultation");

  // إنهاء الكشف
  res = await d.fetch(`/api/queue/${apptId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "complete" }),
  });
  json = await res.json();
  assert(res.status === 200 && json.data.status === "completed", "إنهاء الكشف -> completed");

  // action غلط
  res = await d.fetch(`/api/queue/${apptId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "explode" }),
  });
  assert(res.status === 400, `إجراء مش معروف -> 400 (طلع ${res.status})`);

  // ===== 4) مكتبة التشخيصات =====
  console.log("\n== 4) مكتبة التشخيصات ===");
  res = await d.fetch("/api/diagnoses", {
    method: "POST",
    body: JSON.stringify({
      title: "التهاب لثة تجريبي",
      diagnosis: "التهاب بسيط في اللثة",
      prescription: "غسول مطهر 3 مرات يوميًا",
    }),
  });
  json = await res.json();
  assert(res.status === 201, `إضافة تشخيص جاهز -> 201 (طلع ${res.status})`);
  const diagId = json.data.id;

  res = await d.fetch("/api/diagnoses?q=لثة");
  json = await res.json();
  assert(res.status === 200 && json.data.some((x) => x.id === diagId), "البحث في المكتبة لقى التشخيص");

  res = await d.fetch(`/api/diagnoses/${diagId}/use`, { method: "POST" });
  assert(res.status === 200, "عدّاد الاستخدام زاد");

  res = await d.fetch("/api/diagnoses", { method: "POST", body: JSON.stringify({ title: "x" }) });
  assert(res.status === 400, `تشخيص بدون محتوى -> 400 (طلع ${res.status})`);

  // ===== 5) المتابعات =====
  console.log("\n== 5) إدارة المتابعات ===");
  // نعمل متابعة متأخرة: زيارة بتاريخ فاتت + follow_up_date فات
  res = await d.fetch("/api/patients", {
    method: "POST",
    body: JSON.stringify({ full_name: "مريض متابعة اختبار", phone: "01055123456", age: 25 }),
  });
  json = await res.json();
  const fupPatientId = json.data.id;

  const past = new Date();
  past.setDate(past.getDate() - 20);
  res = await d.fetch("/api/visits", {
    method: "POST",
    body: JSON.stringify({
      patient_id: fupPatientId,
      doctor_id: doctorId,
      diagnosis: "كشف أولي — محتاج متابعة",
      price: 200,
      follow_up_date: new Date(past.getTime() + 14 * 86400000).toISOString().slice(0, 10),
    }),
  });
  json = await res.json();
  assert(res.status === 201, `زيارة بتاريخ متابعة فاتت -> 201 (طلع ${res.status})`);
  const visitId = json.data.id;

  res = await d.fetch("/api/follow-ups?filter=due");
  json = await res.json();
  assert(res.status === 200, "قائمة المتابعات المتأخرة -> 200");
  const foundDue = json.data.find((f) => f.visit_id === visitId);
  assert(!!foundDue, "المتابعة المتأخرة ظهرت في القائمة");

  res = await d.fetch("/api/follow-ups", {
    method: "PATCH",
    body: JSON.stringify({ visit_id: visitId, completed: true, result: "تم الاتصال — المريض تحسن" }),
  });
  assert(res.status === 200, "تسجيل إتمام المتابعة -> 200");

  res = await d.fetch("/api/follow-ups?filter=due");
  json = await res.json();
  assert(!json.data.some((f) => f.visit_id === visitId), "المتابعة المكتملة اختفت من القائمة");

  // ===== 6) تقرير أداء الأطباء =====
  console.log("\n== 6) تقرير أداء الأطباء ===");
  res = await d.fetch(`/api/reports/doctor-performance?from=${futureDate(-30)}&to=${futureDate(0)}`);
  json = await res.json();
  assert(res.status === 200, `تقرير أداء الأطباء -> 200 (طلع ${res.status})`);
  assert(Array.isArray(json.data) && json.data.length >= 1, "فيه طبيب واحد على الأقل في التقرير");
  const doc = json.data[0];
  assert(
    typeof doc.visits_count === "number" &&
      typeof doc.revenue === "number" &&
      typeof doc.cancellation_rate === "number",
    "حقول التقرير كاملة (زيارات/إيراد/معدل إلغاء)"
  );

  // ===== 7) عزل: عيادة تانية مش بتشوف بياناتنا =====
  console.log("\n== 7) عزل الـ Multi-tenancy ===");
  const d2 = await login("01099999999", "Clinic2@123");
  res = await d2.fetch("/api/diagnoses?q=لثة");
  json = await res.json();
  assert(res.status === 200 && !json.data.some((x) => x.id === diagId), "العيادة التانية مش شايفة مكتبة التشخيصات بتاعتنا");
  res = await d2.fetch(`/api/queue/${apptId}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "start" }),
  });
  assert(res.status === 404, `العيادة التانية مبتقدرش تعدّل دور عيادتنا -> 404 (طلع ${res.status})`);

  console.log("\n🎉 كل اختبارات الموديولات الجديدة عدّت بنجاح.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
