# نظام إدارة العيادات (Clinic Management SaaS)

تطبيق **Next.js 16 (App Router) + TypeScript + Tailwind CSS + PostgreSQL**
لإدارة العيادات: مواعيد، ملفات مرضى، ومالية/مخزون. الوثائق الأصلية
(الخطة الشاملة والتصميم التقني) موجودة في `docs/`.

> **الحالة الحالية:** 🎉 **الـ MVP التقني الكامل خلص** — كل الـ 7 موديولات المتفق عليها في
> `docs/clinic-saas-technical-design.md` (قسم 4) شغّالة: ✅ Auth + Multi-tenancy، ✅ ملفات المرضى،
> ✅ المواعيد، ✅ الزيارات والمدفوعات، ✅ المرفقات الطبية، ✅ المخزون، و✅ المصروفات والتقارير المالية.

---

## 1. الـ Stack

| الطبقة | الاختيار |
|---|---|
| Frontend/Backend | Next.js 16 (App Router, Server Components, API routes) |
| التنسيق | Tailwind CSS v4، عربي RTL بالكامل (خط Cairo) |
| قاعدة البيانات | PostgreSQL (محلي في السانديبوكس الآن؛ Supabase/Railway لاحقًا للإنتاج) |
| الوصول لقاعدة البيانات | `pg` مباشرة (بدون ORM) — مطابقة كاملة لملف الـ Schema في `docs/` |
| المصادقة | NextAuth v5 (Auth.js) — Credentials provider (رقم هاتف + كلمة مرور) |

---

## 2. تشغيل المشروع محليًا

### 2.1 تجهيز قاعدة البيانات (أول مرة أو بعد أي إعادة تشغيل للسانديبوكس)

> ⚠️ ملحوظة مهمة: بيانات PostgreSQL بتتخزن في `/var/lib/postgresql` وهو
> مسار برّه `/home/user`، يعني **مش بيتحفظ** بين جلسات العمل. لازم تشغّل
> السكريبت ده تاني في أي جلسة جديدة قبل ما تشتغل.

```bash
bash scripts/setup-db.sh   # يثبّت Postgres (لو مش موجود) + ينشئ الداتابيز + يطبّق الـ migrations
node scripts/seed.js       # (اختياري) بيانات تجريبية: عيادة + طبيب + سكرتيرة
```

### 2.2 متغيرات البيئة

الملف `.env` موجود بالفعل بإعدادات محلية جاهزة:

```
DATABASE_URL=postgresql://clinic_app:clinic_app_pw@localhost:5432/clinic_saas
AUTH_SECRET=dev-secret-change-me-in-production-please-32chars
NEXTAUTH_URL=http://localhost:3000
```

غيّرها في الإنتاج (خصوصًا `AUTH_SECRET` و `DATABASE_URL`).

### 2.3 تشغيل السيرفر

```bash
npm run dev
```

الافتراضي: `http://localhost:3000` — بيعمل Redirect تلقائي لـ `/login` لو مسجّلتش دخول.

### 2.4 بيانات دخول تجريبية (بعد تشغيل `seed.js`)

| الدور | الهاتف | كلمة المرور |
|---|---|---|
| طبيب | `01000000001` | `Doctor@123` |
| سكرتارية | `01000000002` | `Reception@123` |

---

## 3. هيكل المشروع

```
clinic-saas/
├─ db/migrations/           # ملفات SQL بترتيب تسلسلي (001_..., 002_...)
├─ scripts/
│  ├─ setup-db.sh           # تثبيت/تشغيل Postgres + إنشاء الداتابيز
│  ├─ migrate.js            # مُشغّل migrations بسيط (يسجل الحالة في schema_migrations)
│  └─ seed.js               # بيانات تجريبية
├─ src/
│  ├─ auth.ts               # إعدادات NextAuth الكاملة (Credentials + DB) — Node runtime فقط
│  ├─ auth.config.ts        # إعدادات خفيفة بدون DB — تُستخدم في middleware (Edge runtime)
│  ├─ middleware.ts         # حماية الصفحات (Redirect لو مش مسجّل دخول)
│  ├─ lib/db.ts             # PostgreSQL connection pool + helper query()
│  ├─ lib/types.ts          # أنواع مشتركة (UserRole, SessionUser)
│  ├─ types/next-auth.d.ts  # توسيع أنواع next-auth (session.user.clinicId, role...)
│  └─ app/
│     ├─ login/page.tsx     # صفحة تسجيل الدخول
│     ├─ dashboard/page.tsx # لوحة تحكم بسيطة تعرض بيانات الجلسة/العيادة
│     └─ api/auth/[...nextauth]/route.ts
└─ docs/                    # نسخة من الخطة والتصميم التقني الأصليين
```

### ملاحظة مهمة عن Edge Runtime

`middleware.ts` في Next.js بيشتغل على **Edge runtime**، ومكتبات زي `pg`
و`bcryptjs` مش متوافقة معاه (Node-only). عشان كده فصلنا الإعدادات:

- `auth.config.ts`: إعدادات خفيفة (بدون أي DB import) — يُستخدم في الـ middleware بس للتحقق من وجود جلسة (JWT) والتوجيه.
- `auth.ts`: الإعدادات الكاملة (فيها `Credentials.authorize()` اللي بيعمل query على `users` table) — يشتغل فقط في Route Handlers / Server Components (Node runtime).

**أي موديول جديد هيحتاج يتعامل مع قاعدة البيانات لازم يكون في route handler أو server component، مش في middleware.**

---

## 4. الـ Multi-tenancy (أساس النظام)

- كل عيادة = صف في جدول `clinics`.
- كل مستخدم (`users`) مربوط بعيادة واحدة عبر `clinic_id`.
- تسجيل الدخول بيتم برقم الهاتف (unique عالميًا في `users`)، وبعد الدخول
  بيتخزن `clinicId` و`role` في الـ JWT session.
- **أي Query جديد على أي جدول (patients, appointments, visits, ...) لازم
  يتفلتر إجباريًا بـ `clinic_id = session.user.clinicId`** — ده الأساس
  اللي لازم يتطبق بدقة في كل موديول قادم، تمامًا زي ما هو موضّح في
  `docs/clinic-saas-technical-design.md`.
- تم اختبار العزل فعليًا: عيادتين مختلفتين بمستخدمين مختلفين، وكل مستخدم
  شاف بيانات عيادته فقط.

---

## 5. الحالة: الـ MVP التقني مكتمل ✅ — إيه اللي بعد كده؟

كل الموديولات السبعة المتفق عليها في `docs/clinic-saas-technical-design.md` (قسم 4) خلصت:

1. ✅ `clinics` + `users` + Auth + Multi-tenancy middleware
2. ✅ `patients` (CRUD + بحث)
3. ✅ `appointments` (تقويم + منع تعارض)
4. ✅ `visits` + `payments` (الكشف والدفع)
5. ✅ `attachments` (رفع الملفات)
6. ✅ `inventory_items` + `inventory_movements`
7. ✅ `expenses` + `reports` (التقارير المالية المجمّعة)

حسب خطة المشروع (`clinic-saas-project-plan.md`، قسم 12)، الخطوات الطبيعية
اللي بعد كده:

- **اختبار داخلي شامل** (العب دور طبيب + سكرتيرة بنفسك يوم كامل على النظام)
- **تجهيز مادة تدريب مبسطة** للعيادة التجريبية (فيديو قصير أو صفحة توضيحية)
- **الانتقال من Postgres محلي إلى استضافة فعلية** (Supabase/Railway + Vercel) —
  ضروري قبل أي استخدام حقيقي، لأن قاعدة البيانات دلوقتي جوه الـ sandbox
  ومش بتتحفظ بين الجلسات
- **إطلاق تجريبي مع عيادة واحدة (Pilot)** في المنصورة

لو حابب تضيف ميزة مش في الـ MVP الأساسي (زي بوابة حجز ذاتي للمريض،
تذكيرات SMS/WhatsApp، أو تصدير تقرير PDF)، قولّي وهنضيفها كموديول إضافي.

---

## 6. موديول المرضى (Module 2) — التفاصيل

### الملفات المضافة
```
db/migrations/002_patients.sql   # جدول patients + فهارس البحث (trigram)
src/lib/patients/types.ts        # نوع Patient
src/lib/patients/schema.ts       # Zod validation (إنشاء/تعديل)
src/lib/api-auth.ts              # helper للتحقق من الجلسة داخل الـ API routes
src/app/api/patients/route.ts        # GET (بحث + Pagination) / POST (إنشاء)
src/app/api/patients/[id]/route.ts   # GET (تفاصيل) / PATCH (تعديل جزئي)
src/app/patients/page.tsx            # قائمة المرضى + بحث + صفحات
src/app/patients/new/page.tsx        # إضافة مريض جديد
src/app/patients/[id]/page.tsx       # عرض/تعديل مريض + مكان سجل الزيارات (لاحقًا)
src/app/patients/patient-form.tsx    # فورم مشترك للإضافة والتعديل
scripts/test-patients.js             # اختبار تكاملي (CRUD + بحث + عزل العيادات)
```

### أهم القرارات
- البحث بيشتغل بالاسم (جزء منه) أو رقم التليفون، باستخدام `ILIKE '%...%'`
  اللي بيستفيد من فهرس `gin_trgm_ops` المعرّف في `docs/clinic-saas-technical-design.md`.
- كل الـ API endpoints بتتفلتر إجباريًا بـ `clinic_id` بتاع الجلسة — تم
  اختبار العزل عمليًا (عيادة تانية بترجع 404 لو حاولت توصل لمريض مش بتاعها).
- مفيش endpoint حذف (Delete) للمرضى بقصد — البيانات الطبية بيُفضّل ما
  تتمسحش، ولو احتجنا "أرشفة" لاحقًا هنضيف عمود `is_active` بدل الحذف الفعلي.
- الطلبات لـ `/api/*` من غير تسجيل دخول بترجع `401 JSON` (مش Redirect HTML)
  عشان تبقى صالحة للاستخدام كـ API نظيف.

### تشغيل اختبار موديول المرضى يدويًا

```bash
node scripts/test-patients.js
```

بيغطي: إنشاء مريض، رفض بيانات غير صالحة، البحث بالاسم/بالتليفون، تعديل
جزئي، وعزل الـ Multi-tenancy بين عيادتين مختلفتين.

---

## 7. موديول المواعيد (Module 3) — التفاصيل

### الملفات المضافة
```
db/migrations/003_appointments.sql       # جدول appointments + فهارس (clinic+date, doctor+date)
src/lib/appointments/types.ts            # أنواع Appointment / AppointmentWithNames
src/lib/appointments/schema.ts           # Zod validation (إنشاء/تعديل)
src/lib/appointments/conflict.ts         # منطق منع تعارض الحجز (Double booking)
src/app/api/appointments/route.ts            # GET (حسب اليوم/الفترة) / POST (حجز)
src/app/api/appointments/[id]/route.ts       # PATCH (تعديل/تغيير حالة) / DELETE
src/app/api/appointments/check-conflict/route.ts  # فحص تعارض مباشر من الواجهة
src/app/api/doctors/route.ts             # قائمة أطباء العيادة (لفورم الحجز)
src/app/appointments/page.tsx            # عرض يومي للمواعيد + تنقل بين الأيام
src/app/appointments/new/page.tsx        # حجز موعد جديد
src/components/patient-picker.tsx        # بحث واختيار مريض (autocomplete) — مشترك مع موديول الزيارات
scripts/test-appointments.js             # اختبار تكاملي (منع تعارض + عزل العيادات)
```

### منطق منع تعارض الحجز (Double booking)
موعدين بيتعارضوا لو فتراتهم الزمنية اتقاطعت: `start1 < end2 AND start2 < end1`،
باستثناء المواعيد اللي حالتها `cancelled` أو `no_show` (متعتبرش شغل الفترة).
التحقق بيتم:
- عند إنشاء موعد جديد (`POST /api/appointments`) → بيرجع `409 Conflict` فيه
  تفاصيل الموعد المتعارض.
- عند تعديل/تأجيل موعد موجود (`PATCH /api/appointments/:id`) → بنفس
  المنطق، مع استثناء الموعد نفسه من الفحص.
- فيه endpoint مستقل (`GET /api/appointments/check-conflict`) لفحص سريع
  من الواجهة قبل الحفظ، لو حبينا نستخدمه في تحسينات UI لاحقًا.

### أهم القرارات
- الطبيب والسكرتارية الاتنين قادرين يحجزوا/يعدّلوا مواعيد (مفيش قيود
  صلاحيات إضافية في الـ MVP، مطابق لما هو موضّح في خطة المشروع).
- `DELETE` بيمسح الموعد نهائيًا (لتصحيح خطأ إدخال)، أما الإلغاء الفعلي
  فالأفضل يكون عبر `PATCH { status: "cancelled" }` عشان يفضل في السجل.
- التقويم في الـ MVP ده عرض يومي مع تنقل سهل بين الأيام (◀ ▶ + Date picker)
  بدل شبكة أسبوعية كاملة، تبسيطًا للاستخدام اليومي الفعلي في العيادة.

### تشغيل اختبار موديول المواعيد يدويًا

```bash
node scripts/test-appointments.js
```

بيغطي: حجز موعد، رفض حجز متعارض (409)، حجز بواسطة السكرتارية، فحص
endpoint التعارض، رفض مريض/طبيب من عيادة تانية، تغيير الحالة، إلغاء ثم
إعادة استخدام الفترة، رفض تأجيل لفترة متعارضة، عزل الـ Multi-tenancy،
والحذف.

> ⚠️ السكريبت بيحتاج مستخدم تجريبي لعيادة ثانية (`01099999999` /
> `Clinic2@123`) عشان يختبر العزل بين العيادات. لو مش موجود، أنشئه مؤقتًا
> بنفس طريقة `seed.js` قبل تشغيل الاختبار، وامسحه بعدين.

---

## 8. موديول الزيارات والمدفوعات (Module 4) — التفاصيل

### الملفات المضافة
```
db/migrations/004_visits_payments.sql    # جدولا visits و payments + فهارس
src/lib/visits/types.ts                  # أنواع Visit / Payment / VisitWithDetails
src/lib/visits/schema.ts                 # Zod validation (زيارة / دفعة)
src/lib/visits/queries.ts                # جلب زيارة كاملة (مدفوعات + إجمالي/متبقي)
src/lib/db.ts (withTransaction)          # helper لتنفيذ عمليات مركّبة بأمان (BEGIN/COMMIT/ROLLBACK)
src/app/api/visits/route.ts              # POST (إنشاء زيارة + دفعة أولية اختيارية)
src/app/api/visits/[id]/route.ts         # GET (تفاصيل) / PATCH (تعديل)
src/app/api/visits/[id]/payments/route.ts # POST (تسجيل دفعة جديدة)
src/app/api/patients/[id]/route.ts       # (محدّث) بيرجع سجل الزيارات مع تفاصيل المريض
src/app/visits/new/page.tsx              # تسجيل كشف جديد (يدعم الحضور من المواعيد)
src/app/visits/[id]/page.tsx             # عرض/تعديل الكشف + تسجيل مدفوعات
src/app/patients/[id]/page.tsx           # (محدّث) عرض سجل الزيارات الفعلي
src/app/appointments/page.tsx            # (محدّث) زرار "بدء الكشف" على المواعيد النشطة
scripts/test-visits.js                   # اختبار تكاملي (دفع جزئي/كامل + عزل العيادات)
```

### أهم القرارات
- إنشاء زيارة مرتبطة بموعد (`appointment_id`) بيحوّل حالة الموعد تلقائيًا
  لـ `completed` — وده اللي بيربط موديول المواعيد بموديول الزيارات عمليًا
  (زرار "بدء الكشف" في صفحة المواعيد بياخدك مباشرة لفورم الزيارة مع تجهيز
  المريض/الطبيب/الموعد مسبقًا).
- المدفوعات بتدعم **الدفع الجزئي**: ممكن كذا دفعة على نفس الزيارة، والنظام
  بيحسب `total_paid` و`remaining_balance` تلقائيًا من مجموع صفوف `payments`.
- إنشاء الزيارة + الدفعة الأولية (لو موجودة) بيحصل جوه **Transaction واحدة**
  (`withTransaction` في `lib/db.ts`) عشان نضمن اتساق البيانات (يا يتسجلوا
  الاتنين مع بعض، يا محدش).
- `GET /api/patients/:id` بقى بيرجّع سجل الزيارات كامل (تاريخ، تشخيص،
  السعر، الطبيب، إجمالي المدفوع) — مطابق لوصف الـ endpoint الأصلي في
  التصميم التقني ("يشمل سجل الزيارات").
- مفيش endpoint حذف للزيارات أو المدفوعات بقصد — نفس منطق عدم حذف
  البيانات الطبية/المالية اللي اتطبق في موديول المرضى.

### تشغيل اختبار موديول الزيارات يدويًا

```bash
node scripts/test-visits.js
```

بيغطي: إنشاء زيارة مرتبطة بموعد (والتأكد إن الموعد بقى `completed`)، دفع
جزئي ثم إكمال المبلغ المتبقي، رفض مبلغ دفع سالب، رفض مريض من عيادة تانية،
تعديل بيانات الزيارة، ظهور الزيارة في سجل المريض، وعزل الـ Multi-tenancy.

> ⚠️ زي سكريبت المواعيد، محتاج مستخدم عيادة ثانية تجريبي لاختبار العزل.

---

## 9. موديول المرفقات الطبية (Module 5) — التفاصيل

### الملفات المضافة
```
db/migrations/005_attachments.sql            # جدول attachments + فهرس
src/lib/attachments/types.ts                 # أنواع Attachment / AttachmentWithUrl
src/lib/attachments/storage.ts               # حفظ/حذف/قراءة الملفات على القرص محليًا
src/app/api/visits/[id]/attachments/route.ts # GET (قائمة) / POST (رفع ملف)
src/app/api/attachments/[id]/route.ts        # DELETE (حذف مرفق)
src/app/api/attachments/[id]/file/route.ts   # GET (تحميل/عرض محتوى الملف الفعلي)
src/app/visits/[id]/attachments-section.tsx  # واجهة رفع/عرض/حذف المرفقات
scripts/test-attachments.js                  # اختبار تكاملي (رفع/تحميل/عزل/حذف)
```

### أهم القرارات (مهمة لخصوصية البيانات الطبية)
- الملفات **مش متخزنة في `public/`** — بتتخزن في `storage/uploads/<clinicId>/<visitId>/<uuid>.<ext>`
  برّه مجلد public تمامًا. القراءة بتتم **حصريًا** عبر
  `GET /api/attachments/:id/file` بعد التحقق من الجلسة وإن المرفق بتاع
  نفس عيادة المستخدم (عبر join مع جدول `visits`). ده بيمنع أي شخص من
  الوصول لصورة أشعة/تحليل بمجرد تخمين رابط، وهو تطبيق فعلي لبند
  "خصوصية البيانات الطبية" المذكور في مخاطر المشروع (`clinic-saas-project-plan.md`).
- الأنواع المسموحة: `JPG`, `PNG`, `WEBP`, `PDF` فقط، وبحد أقصى **10 ميجابايت**
  للملف الواحد — بيتم التحقق من الـ MIME type الفعلي مش بس امتداد الاسم.
- في بيئة إنتاج حقيقية (مش الـ sandbox المحلي ده)، الأفضل استبدال
  `lib/attachments/storage.ts` بتخزين سحابي (Supabase Storage / Cloudflare R2)
  زي ما هو مقترح في `docs/clinic-saas-technical-design.md` — الكود متعمول
  Design بحيث الاستبدال ده يبقى في ملف واحد بس (`storage.ts`) من غير ما
  يأثر على الـ API routes.
- مفيش تحديد لمين يقدر يرفع/يحذف مرفقات (نفس منطق باقي الموديولات:
  الطبيب والسكرتارية الاتنين قادرين).

### تشغيل اختبار موديول المرفقات يدويًا

```bash
node scripts/test-attachments.js
```

بيغطي: رفع صورة صالحة، رفض ملف بنوع MIME غير مدعوم، رفض `file_type` غير
صحيح، جلب قائمة المرفقات، تحميل محتوى الملف والتأكد إنه مطابق **بايت
لبايت** للأصلي، عزل الـ Multi-tenancy (تحميل/عرض/حذف)، ووصول بدون تسجيل
دخول، ثم الحذف الفعلي (من قاعدة البيانات ومن القرص).

> ⚠️ زي باقي السكريبتات، محتاج مستخدم عيادة ثانية تجريبي لاختبار العزل.
> ⚠️ مجلد `storage/uploads/` بيتولّد تلقائيًا وبيحتوي على ملفات حقيقية —
> اتأكد إنه مش فاضل فيه بيانات اختبار قبل ما تسيب المشروع (`rm -rf storage/uploads`).

---

## 10. موديول المخزون (Module 6) — التفاصيل

### الملفات المضافة
```
db/migrations/006_inventory.sql              # جدولا inventory_items و inventory_movements + فهرس
src/lib/inventory/types.ts                   # أنواع InventoryItem / InventoryMovement
src/lib/inventory/schema.ts                  # Zod validation (صنف / حركة)
src/app/api/inventory/route.ts               # GET (قائمة) / POST (إضافة صنف)
src/app/api/inventory/[id]/route.ts          # GET (تفاصيل) / PATCH (تعديل بيانات الصنف)
src/app/api/inventory/[id]/movements/route.ts # GET (سجل الحركات) / POST (تسجيل حركة)
src/app/api/inventory/low-stock/route.ts     # GET (الأصناف تحت الحد الأدنى)
src/app/inventory/page.tsx                   # قائمة المخزون + إضافة/سحب سريع (+/-)
src/app/inventory/new/page.tsx               # إضافة صنف جديد
src/app/inventory/[id]/page.tsx              # تعديل الصنف + تسجيل حركة + سجل الحركات
scripts/test-inventory.js                    # اختبار تكاملي (حركات + حد أدنى + عزل العيادات)
```

### أهم القرارات
- **الكمية (`quantity`) مبتتعدلش مباشرة عبر `PATCH`** — أي تغيير في الكمية
  لازم يعدي عبر `POST /api/inventory/:id/movements` عشان يفضل فيه
  **Audit trail** كامل (مين غيّر، امتى، وليه) في جدول `inventory_movements`،
  مطابق للغرض من وجود الجدول ده في التصميم التقني أصلًا.
- تحديث الكمية + تسجيل الحركة بيحصلوا في **Transaction واحدة** مع
  `SELECT ... FOR UPDATE` على صف الصنف، عشان نمنع أي Race condition لو
  حصل تسجيل حركتين على نفس الصنف في نفس اللحظة (مثلاً السكرتارية
  والطبيب بيسجلوا في نفس الوقت من جهازين مختلفين).
- **رفض أي سحب يخلي الكمية بالسالب** — بيرجع `400` برسالة واضحة
  ("الكمية المتاحة غير كافية").
- `is_low_stock` بيتحسب ديناميكيًا (`quantity <= min_threshold`) في كل
  استعلام بدل ما يتخزن كعمود منفصل، عشان يفضل متسق دايمًا مع تغيّر
  الحدين.
- زرار +/- سريع في قائمة المخزون لسهولة الاستخدام اليومي، بجانب فورم
  تفصيلي (مع سبب الحركة) في صفحة تفاصيل الصنف.

### تشغيل اختبار موديول المخزون يدويًا

```bash
node scripts/test-inventory.js
```

بيغطي: إضافة صنف، رفض بيانات ناقصة، سحب كمية، **رفض سحب أكبر من المتاح**،
رفض حركة بقيمة صفر، وصول الصنف لحالة "تحت الحد الأدنى" وظهوره في
`low-stock`، تعديل بيانات الصنف من غير المساس بالكمية، وعزل الـ
Multi-tenancy.

> ⚠️ زي باقي السكريبتات، محتاج مستخدم عيادة ثانية تجريبي لاختبار العزل.

---

## 11. موديول المصروفات والتقارير المالية (Module 7) — التفاصيل

### الملفات المضافة
```
db/migrations/007_expenses.sql           # جدول expenses + فهرس
src/lib/expenses/types.ts                # نوع Expense
src/lib/expenses/schema.ts               # Zod validation
src/lib/reports/queries.ts               # استعلامات الإيرادات/المصروفات/الملخص المجمّع
src/app/api/expenses/route.ts            # GET (قائمة) / POST (تسجيل مصروف)
src/app/api/expenses/[id]/route.ts       # DELETE (حذف مصروف)
src/app/api/reports/revenue/route.ts     # GET (تقرير الإيرادات)
src/app/api/reports/expenses/route.ts    # GET (تقرير المصروفات)
src/app/api/reports/summary/route.ts     # GET (ملخص يومي/أسبوعي/شهري)
src/app/expenses/page.tsx                # قائمة المصروفات + فلترة بالتاريخ
src/app/expenses/new/page.tsx            # تسجيل مصروف جديد
src/app/reports/page.tsx                 # لوحة التقارير المالية (إيراد/مصروف/صافي ربح)
scripts/test-expenses-reports.js         # اختبار تكاملي شامل
```

### أهم القرارات
- **الإيرادات في التقارير = مجموع المدفوعات الفعلية (`payments`)**، مش
  سعر الكشف (`visits.price`) — عشان يعكس الكاش الحقيقي اللي دخل العيادة
  فعلًا، حتى لو فيه زيارات لسه عليها متبقي (مديونية).
- تقرير `summary` بيجمع بيانات من جدولين مختلفين (`payments` عبر `visits`،
  و`expenses`) ويدمجهم في نفس الـ "bucket" الزمني (يوم/أسبوع/شهر) عشان
  يحسب **صافي الربح = الإيراد − المصروف** لكل فترة.
- المدى الزمني الافتراضي: آخر 30 يوم لتقارير `revenue`/`expenses`، وآخر
  30 يوم / 12 أسبوع / 12 شهر لملخص `summary` حسب الفترة المختارة — قابل
  للتخصيص عبر `?from=&to=`.
- إضافة `DELETE /api/expenses/:id` كامتداد عملي بسيط فوق التصميم
  الأصلي (اللي فيه GET/POST بس) لتسهيل تصحيح أخطاء الإدخال اليدوي.
- صفحة `/reports` بتستخدم أشرطة CSS بسيطة (من غير أي مكتبة رسوم بيانية
  خارجية) لعرض مقارنة الإيراد/المصروف بصريًا — يفضل خفيف ومتوافق مع
  معاينة الملفات جوه الـ sandbox.

### تشغيل اختبار الموديول يدويًا

```bash
node scripts/test-expenses-reports.js
```

بيغطي: تسجيل مصروفات، رفض بيانات غير صالحة، حساب الإجمالي، إنشاء زيارة
ودفعة والتأكد من ظهورها في تقرير الإيرادات (بما فيها التصنيف حسب طريقة
الدفع)، تقرير المصروفات حسب التصنيف، **صحة حساب صافي الربح** في الملخص
اليومي، نجاح الملخص الأسبوعي/الشهري، رفض قيمة `period` غير صحيحة، حذف
مصروف، وعزل الـ Multi-tenancy الكامل (قوائم وتقارير).

> ⚠️ زي باقي السكريبتات، محتاج مستخدم عيادة ثانية تجريبي لاختبار العزل.

---

## 12. ملخص شامل — كل الموديولات (Build Order كامل)

| # | الموديول | الحالة | الاختبار |
|---|---|---|---|
| 1 | Auth + Multi-tenancy | ✅ | يدوي (curl end-to-end) |
| 2 | ملفات المرضى | ✅ | `scripts/test-patients.js` |
| 3 | المواعيد (منع تعارض) | ✅ | `scripts/test-appointments.js` |
| 4 | الزيارات والمدفوعات | ✅ | `scripts/test-visits.js` |
| 5 | المرفقات الطبية | ✅ | `scripts/test-attachments.js` |
| 6 | المخزون | ✅ | `scripts/test-inventory.js` |
| 7 | المصروفات والتقارير | ✅ | `scripts/test-expenses-reports.js` |

لتشغيل كل الاختبارات مرة واحدة بعد أي تعديل مستقبلي في الكود:

```bash
for f in scripts/test-*.js; do echo "=== $f ==="; node "$f" || break; done
```

> ⚠️ محتاج تتأكد إن فيه مستخدم عيادة ثانية تجريبي (`01099999999` /
> `Clinic2@123`) موجود قبل تشغيل السكريبتات دي كلها، لأن أغلبها بيختبر
> عزل الـ Multi-tenancy.

---

## 13. إعادة تصميم الواجهة: Sidebar + Topbar + Dashboard حقيقي

بعد اكتمال الـ MVP التقني، اتعمل تعديل شامل على شكل الواجهة (من غير أي
تغيير في منطق الـ API أو قاعدة البيانات):

### التغييرات
- **قائمة جانبية ثابتة (Sidebar)** — `src/components/sidebar.tsx` — أيقونات
  بس افتراضيًا، وبتتوسع لما الماوس يوقف عليها (`group-hover`) عشان تظهر
  أسماء الأقسام كاملة. موجودة في كل صفحات النظام.
- **شريط علوي ثابت (Topbar)** — `src/components/topbar.tsx` — اسم العيادة،
  اسم المستخدم ودوره، وزرار تسجيل الخروج.
- **Layout مشترك** — `src/app/(app)/layout.tsx` — Route Group باسم `(app)`
  بيجمع كل الصفحات المحمية (dashboard, patients, appointments, visits,
  inventory, expenses, reports) تحت نفس الـ Sidebar/Topbar، من غير ما
  يأثر على الروابط (Route Groups بين قوسين مبتظهرش في الـ URL).
- **لوحة تحكم حقيقية (Dashboard)** — `src/app/(app)/dashboard/page.tsx` —
  بقت بتعرض بيانات حية بدل كروت روابط بس: عدد المرضى، مواعيد النهاردة،
  إيرادات الشهر، تنبيه المخزون، رسم بياني بسيط لاتجاه الإيرادات آخر 7
  أيام، قائمة مواعيد النهاردة الجاية، وقائمة آخر نشاط (مرضى/زيارات/مدفوعات).
- **API جديد**: `GET /api/dashboard/summary` (`src/lib/dashboard/queries.ts`)
  بيجمع كل أرقام الداشبورد دي في استعلام واحد مجمّع (Promise.all لتوازي
  الاستعلامات)، متفلتر بـ `clinic_id` زي كل حاجة تانية في النظام. الصفحة
  نفسها Server Component بتستخدم نفس الدالة مباشرة (من غير fetch إضافي)،
  والـ API endpoint متاح لأي استخدام مستقبلي (تحديث تلقائي، تطبيق موبايل...).

### ملاحظات مهمة
- كل الصفحات اتنقلت جوه `src/app/(app)/` لكن **الروابط (URLs) متغيّرتش
  خالص** — `/patients`, `/appointments`, `/visits/new`... إلخ لسه بنفس
  الشكل.
- كل صفحة اتشالها الهيدر المكرر (اللي كان فيه "← رجوع للوحة التحكم")
  لأن الـ Sidebar بقى موجود دايمًا؛ اتفضل بس عنوان الصفحة + أي أزرار
  إجراء (زي "+ إضافة مريض جديد").
- اتعمل regression test كامل بعد التعديل: كل سكريبتات الاختبار الستة
  (`test-patients.js` ... `test-expenses-reports.js`) اتشغّلت تاني وعدّت
  100% — يعني إعادة التصميم دي لمستش أي منطق API أو قاعدة بيانات.
- الشكل العام (الألوان) فضل زي ما هو (Light theme, Sky Blue) بناءً على
  اختيارك.

---

## 14. تعديلات طبية وتشغيلية إضافية (Migration 008)

بناءً على ملاحظات عملية من الاستخدام الفعلي:

### الملفات المضافة/المعدّلة
```
db/migrations/008_patient_notes_and_visit_type.sql   # has_chronic_disease + visit_type/price
src/app/globals.css                                  # إصلاح: color-scheme: light لمنع اختفاء نص الحقول في Dark Mode
src/lib/patients/{types,schema}.ts                   # has_chronic_disease
src/app/api/patients/**                              # يشمل has_chronic_disease في كل الاستعلامات
src/app/(app)/patients/patients-page-client.tsx       # عمود "ملاحظات هامة" ظاهر في القائمة مباشرة
src/app/(app)/patients/patient-form.tsx               # سؤال "مرض مزمن؟" (نعم/لا/غير محدد)
src/lib/appointments/{types,schema}.ts               # visit_type (كشف/متابعة) + price
src/app/api/appointments/route.ts                    # POST بيقبل visit_type/price/patient_has_chronic_disease
src/app/api/appointments/[id]/route.ts               # + GET (جديد) لجلب موعد واحد
src/app/(app)/appointments/new/page.tsx              # نوع الزيارة + السعر + سؤال المرض المزمن
src/app/(app)/appointments/page.tsx                  # عرض نوع الزيارة والسعر في القائمة
src/lib/visits/schema.ts + api/visits/route.ts       # السعر بقى اختياري وبيتسحب تلقائيًا من الموعد
src/app/(app)/visits/new/page.tsx                    # حذف حقل السعر، عرضه Read-only من الموعد
scripts/test-new-requirements.js                     # اختبار تكاملي للتعديلات دي
```

### أهم القرارات
1. **الملاحظات الهامة (حساسية/تنبيهات) وحالة "مرض مزمن؟" بقوا ظاهرين في
   قائمة المرضى مباشرة** (شارات ملوّنة) — من غير الحاجة لفتح ملف المريض،
   بالظبط زي المطلوب.
2. **"مرض مزمن؟" اتخزن كخاصية دائمة على المريض** (`patients.has_chronic_disease`)
   مش على الموعد نفسه، لأنه بيوصف المريض مش الزيارة — لكن السؤال بيتسأل
   في صفحة الحجز عشان يتسجّل/يتحدّث في نفس اللحظة اللي السكرتارية بتحجز
   فيها.
3. **نوع الزيارة (كشف/متابعة) والسعر اتضافوا على مستوى الموعد نفسه**
   (`appointments.visit_type`, `appointments.price`) لأنهم بيتحددوا وقت
   الحجز.
4. **حقل السعر اتشال من صفحة "تسجيل كشف جديد"** — لو الزيارة مرتبطة
   بموعد، السعر بيتسحب تلقائيًا من `appointments.price` (وبيتعرض Read-only
   فوق الفورم للمراجعة بس)، ولو من غير موعد (كشف مباشر) بيتسجّل صفر
   ويقدر الطبيب يعدّله بعدين من صفحة تفاصيل الزيارة.
5. **إصلاح باگ حقيقي**: حقول الإدخال كانت بتظهر بلون نص شبه مختفي على
   أجهزة شغّالة Dark Mode، بسبب استخدام `prefers-color-scheme` في الـ CSS
   القديم. اتحل بتثبيت `color-scheme: light` + لون نص صريح لكل حقول
   الفورم، بغض النظر عن إعدادات جهاز المستخدم.

### تشغيل اختبار التعديلات دي يدويًا

```bash
node scripts/test-new-requirements.js
```

بيغطي: تسجيل ملاحظة هامة ومرض مزمن وظهورهم في نتيجة قائمة المرضى مباشرة،
حجز موعد بنوع "متابعة" وسعر محدد مع تحديث حالة المرض المزمن على المريض،
رفض نوع زيارة غير صحيح، وسحب السعر تلقائيًا من الموعد عند تسجيل الكشف
(وسعر صفري افتراضي لو مفيش موعد مرتبط).

---

## 15. حزمة تحديثات كبيرة: الحجز الأونلاين + نظام الدور الذكي + شاشة الانتظار (Migration 010)

### الميزات الجديدة

1. **🌐 حجز أونلاين 24/7** — صفحة عامة للعيادة على رابط `/b/<slug>`:
   المريض بيختار اليوم والفتحة الفاضية ونوع الزيارة (كشف/متابعة) ويدخل
   بياناته، من غير تسجيل دخول. الحجز بيتسجل مباشرة في المواعيد
   (`booking_source = 'online'`) مع رفض الفتحات المحجوزة/بره ساعات العمل،
   وصفحة متابعة `/b/<slug>/track/<token>` بيتابع منها حالته ورقم دوره.

2. **🪑 نظام الدور الذكي** — صفحة `/queue` للاستقبال:
   تسجيل الحضور بيُسند **رقم دور** تلقائي (فريد لكل عيادة/يوم)، والترتيب
   في قائمة الانتظار: حالات الطوارئ أولًا (priority) ثم رقم الدور. حالات
   جديدة للموعد: `arrived` (حضر) → `in_consultation` (جوه الكشف) →
   `completed`، مع زرار إرجاع للانتظار وعدّاد مدة الانتظار بالدقائق.

3. **🖥️ شاشة انتظار عامة** — `/screen/<slug>` للعرض على تلفزيون الاستقبال:
   رقم الدور الكبير للمريض جوه الكشف، قائمة المنتظرين بمدة الانتظار،
   وآخر المنتهيين — بتحدّث نفسها كل 10 ثواني، ومن غير أي بيانات حساسة
   (أرقام التليفونات مخفية، والأسماء مختصرة).

4. **📚 مكتبة التشخيصات** (Diagnosis Library) — تشخيصات وروشتات جاهزة
   بيضيفها الطبيب، بتظهر في فورم الكشف (`DiagnosisPicker`) ببحث سريع،
   وبتترتب بكثرة الاستخدام (`usage_count`).

5. **🔍 مقارنة الزيارات** — صفحة `/visits/compare` (ولينك من ملف المريض):
   الطبيب بيختار زيارتين لنفس المريض ويقارن التشخيص/الروشتة/الأسعار
   جنب بعض.

6. **📞 إدارة المتابعات** — صفحة `/follow-ups` بتبويبات (متأخرة / النهاردة /
   الأسبوع الجاي) مع زرار واتساب جاهز، حجز متابعة، وتسجيل نتيجة المتابعة
   (`follow_up_result` / `follow_up_completed`) عشان المكتملة تختفي من القائمة.

7. **👨‍⚕️ تقرير أداء الأطباء** — `/reports/doctors`: عدد المرضى الفريدين،
   الزيارات المكتملة، الإيرادات، متوسط قيمة الزيارة، ومعدل الإلغاء لكل
   طبيب في فترة مختارة.

8. **🩸 فصيلة الدم** — حقل جديد في ملف المريض (A+/O-... إلخ) بيظهر في
   ملفه وفي كارت "المريض الحالي" للطبيب في الداشبورد.

9. **👋 داشبورد محسّن** — تحية بالاسم والوقت (صباح/مساء الخير)، وكارت
   "🩺 المريض الحالي" للطبيب فيه (العمر/فصيلة الدم/الحساسية/آخر زيارة)
   بأزرار فتح الملف وبدء الزيارة، وقائمة الانتظار بأرقام الأدوار وحالاتها.

10. **📵 وضع Offline** — Service Worker بسيط (`public/sw.js`) بيخزّن آخر
    بيانات محمّلة: الصفحات والـ GET requests تفضل شغّالة لو النت قطع،
    مع شريط تنبيه برتقالي أسفل الشاشة.

### الملفات الأساسية المضافة

```
db/migrations/010_booking_queue_diagnoses.sql          # كل تغييرات الـ schema
src/lib/queue/queries.ts                                # منطق الدور الذكي + شاشة الانتظار
src/lib/booking/queries.ts                              # الحجز الأونلاين (فتحات/إنشاء/متابعة)
src/app/api/queue/route.ts + [id]/route.ts              # قائمة الدور + إجراءات الحالة
src/app/api/public/book/[slug]/route.ts                 # GET فتحات + POST حجز عام
src/app/api/public/booking/[token]/route.ts             # متابعة حجز عام
src/app/api/public/screen/[slug]/route.ts               # شاشة الانتظار العامة
src/app/api/diagnoses/route.ts + [id]/...               # مكتبة التشخيصات
src/app/api/follow-ups/route.ts                         # قائمة + تسجيل نتيجة المتابعة
src/app/api/reports/doctor-performance/route.ts         # أداء الأطباء
src/app/api/clinic/settings/route.ts                    # إعدادات الحجز (slug/ساعات/أنواع)
src/app/b/[slug]/page.tsx + booking-client.tsx          # صفحة الحجز العامة
src/app/b/[slug]/track/[token]/...                      # صفحة متابعة الحجز
src/app/screen/[slug]/...                               # شاشة التلفزيون
src/app/(app)/queue/...                                 # غرفة الانتظار (موظفو العيادة)
src/app/(app)/follow-ups/...                            # متابعة المرضى
src/app/(app)/visits/compare/...                        # مقارنة الزيارات
src/app/(app)/reports/doctors/...                       # أداء الأطباء
src/app/(app)/settings/booking/...                      # إعدادات الحجز الأونلاين
public/sw.js + src/components/offline-banner.tsx        # وضع Offline
scripts/test-new-modules.js                             # اختبار تكاملي للحزمة كلها
```

### ملاحظات تشغيلية

- **التوقيت**: كل حسابات الأيام (رقم الدور، الفتحات، شاشة الانتظار) بتشتغل
  بتوقيت **Africa/Cairo** — الـ Dockerfile والـ docker-compose مضبوطين
  على `TZ=Africa/Cairo` للـ app وقاعدة البيانات.
- **تفعيل الحجز الأونلاين** لعيادة: من صفحة "الحجز الأونلاين" في القائمة
  الجانبية → فعّل الخدمة واكتب slug إنجليزي (مثل `dr-khaled-nour`).
- الاختبار التكاملي: `node scripts/test-new-modules.js` (والسيرفر شغال).

### تشغيل PostgreSQL محليًا بدون apt (الساندبوكس)

لو `apt install postgresql` مش متاح (زي ما بيحصل في بعض بيئات الـ sandbox)،
فيه سكريبت بديل بيستخدم نسخة Postgres مدمّجة عبر npm:

```bash
node scripts/dev-postgres.js setup    # أول مرة (initdb + إنشاء الداتابيز)
node scripts/dev-postgres.js          # تشغيل في الخلفية (يبقى شغال)
node scripts/migrate.js && node scripts/seed-demo.js
```
