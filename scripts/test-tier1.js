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

  console.log("\n== 1) قائمة الانتظار الحية ==");
  let res = await d.fetch("/api/waiting-queue");
  let json = await res.json();
  assert(res.status === 200, `waiting-queue status -> ${res.status}`);
  assert(Array.isArray(json.data), "النتيجة قايمة");
  assert(typeof json.count === "number", "فيه عداد");
  if (json.data.length > 0) {
    assert(json.data[0].patient_name, "فيه اسم مريض");
    assert(json.data[0].patient_id, "فيه patient_id");
  }
  console.log(`   (عدد المنتظرين: ${json.count})`);

  console.log("\n== 2) توزيع الإيرادات حسب نوع الخدمة في الداشبورد ==");
  res = await d.fetch("/api/dashboard/summary");
  json = await res.json();
  assert(Array.isArray(json.data.revenueByType), "فيه revenueByType");
  assert(Array.isArray(json.data.waitingQueue), "فيه waitingQueue");
  console.log(`   (توزيع الإيرادات: ${JSON.stringify(json.data.revenueByType)})`);

  console.log("\n== 3) حملة استعادة الغائبين ==");
  res = await d.fetch("/api/patients/winback");
  json = await res.json();
  assert(res.status === 200, `winback status -> ${res.status}`);
  assert(Array.isArray(json.data), "النتيجة قايمة");
  if (json.data.length > 0) {
    assert(typeof json.data[0].months_since === "number", "فيه months_since");
    assert(json.data[0].months_since >= 6, "الغائب من 6 شهور أو أكتر");
  }
  console.log(`   (عدد الغائبين: ${json.data.length})`);

  console.log("\n🎉 كل اختبارات Tier 1 عدّت بنجاح.");
}

main().catch((e) => { console.error(e.message); process.exit(1); });
