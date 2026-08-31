const BASE = "http://localhost:3000";

// أصغر ملف PNG صحيح (1×1 بكسل شفاف) — للاختبار فقط
const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

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
        headers: { ...(opts.headers || {}), cookie: cookieHeader() },
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

  console.log("\n== إنشاء مريض وزيارة تجريبية ==");
  let res = await doctor.fetch("/api/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: "عمر حسن", phone: "01077778888" }),
  });
  let json = await res.json();
  const patientId = json.data.id;

  res = await doctor.fetch("/api/doctors");
  json = await res.json();
  const doctorId = json.data[0].id;

  res = await doctor.fetch("/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_id: patientId, doctor_id: doctorId, price: 150 }),
  });
  json = await res.json();
  const visitId = json.data.id;

  console.log("\n== رفع صورة أشعة (PNG صالح) ==");
  const pngBuffer = Buffer.from(TINY_PNG_BASE64, "base64");
  let form = new FormData();
  form.append("file", new Blob([pngBuffer], { type: "image/png" }), "xray.png");
  form.append("file_type", "xray");

  res = await doctor.fetch(`/api/visits/${visitId}/attachments`, { method: "POST", body: form });
  json = await res.json();
  assert(res.status === 201, `رفع الصورة -> status ${res.status}`);
  const attachmentId = json.data.id;
  assert(json.data.file_type === "xray", "نوع المرفق اتسجل صح (xray)");
  assert(json.data.download_url === `/api/attachments/${attachmentId}/file`, "رابط التحميل اتبنى صح");

  console.log("\n== محاولة رفع ملف نوعه غير مدعوم (نص عادي) ==");
  form = new FormData();
  form.append("file", new Blob([Buffer.from("hello")], { type: "text/plain" }), "note.txt");
  form.append("file_type", "other");
  res = await doctor.fetch(`/api/visits/${visitId}/attachments`, { method: "POST", body: form });
  assert(res.status === 400, `رفض ملف نصي -> status ${res.status}`);

  console.log("\n== محاولة رفع بنوع مرفق غير صحيح ==");
  form = new FormData();
  form.append("file", new Blob([pngBuffer], { type: "image/png" }), "x.png");
  form.append("file_type", "not_a_real_type");
  res = await doctor.fetch(`/api/visits/${visitId}/attachments`, { method: "POST", body: form });
  assert(res.status === 400, `رفض نوع مرفق غير صحيح -> status ${res.status}`);

  console.log("\n== جلب قائمة مرفقات الزيارة ==");
  res = await doctor.fetch(`/api/visits/${visitId}/attachments`);
  json = await res.json();
  assert(json.data.length === 1, `فيه مرفق واحد بس مسجل -> عدد ${json.data.length}`);

  console.log("\n== تحميل محتوى الملف فعليًا والتأكد إنه نفس الصورة ==");
  res = await doctor.fetch(`/api/attachments/${attachmentId}/file`);
  assert(res.status === 200, `تحميل الملف -> status ${res.status}`);
  assert(res.headers.get("content-type") === "image/png", "Content-Type اترجع صح (image/png)");
  const downloaded = Buffer.from(await res.arrayBuffer());
  assert(downloaded.equals(pngBuffer), "محتوى الملف المُحمّل مطابق للصورة الأصلية");

  console.log("\n== عزل الـ Multi-tenancy: عيادة تانية ==");
  const doctor2 = await login("01099999999", "Clinic2@123");
  res = await doctor2.fetch(`/api/attachments/${attachmentId}/file`);
  assert(res.status === 404, `عيادة تانية متقدرش تحمّل مرفق مش بتاعها -> status ${res.status}`);

  res = await doctor2.fetch(`/api/visits/${visitId}/attachments`);
  assert(res.status === 404, `عيادة تانية متقدرش تشوف مرفقات زيارة مش بتاعتها -> status ${res.status}`);

  res = await doctor2.fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
  assert(res.status === 404, `عيادة تانية متقدرش تحذف مرفق مش بتاعها -> status ${res.status}`);

  console.log("\n== وصول من غير تسجيل دخول (لازم 401) ==");
  res = await fetch(`${BASE}/api/attachments/${attachmentId}/file`);
  assert(res.status === 401, `طلب من غير جلسة -> status ${res.status}`);

  console.log("\n== حذف المرفق (من العيادة الصح) ==");
  res = await doctor.fetch(`/api/attachments/${attachmentId}`, { method: "DELETE" });
  assert(res.status === 200, `حذف المرفق -> status ${res.status}`);

  res = await doctor.fetch(`/api/attachments/${attachmentId}/file`);
  assert(res.status === 404, `الملف مبقاش موجود بعد الحذف -> status ${res.status}`);

  console.log("\n🎉 كل اختبارات موديول المرفقات عدّت بنجاح.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
