# دليل النشر على VPS هوستنجر (Hostinger)

الدليل ده بيشرح خطوة بخطوة إزاي تنشر نظام إدارة العيادات على VPS هوستنجر
بتاعك، باستخدام **Docker** — عشان النشر يبقى ثابت وسهل التكرار، ومحتاج
أقل تدخل ممكن منك.

تم بناء واختبار كل ملفات النشر دي فعليًا (Docker build + docker-compose
+ تسجيل دخول حقيقي + إعادة تشغيل والتأكد إن البيانات بتفضل محفوظة) قبل
ما تتسلّمها.

---

## 0. الفكرة العامة (3 خدمات في Docker Compose)

```
المتصفح ──HTTPS(443)──▶ Caddy (SSL تلقائي) ──▶ Next.js App (port 3000) ──▶ PostgreSQL
```

- **Caddy**: بياخد شهادة SSL مجانية تلقائيًا من Let's Encrypt لدومينك، وبيوجّه الترافيك للتطبيق.
- **App**: تطبيق Next.js نفسه (Docker image مبني من الكود).
- **DB**: PostgreSQL 17، بياناته متخزنة في Docker volume (تفضل موجودة حتى لو الـ container اتحذف).

---

## 1. متطلبات على الـ VPS

- Ubuntu/Debian (الأغلبية عند هوستنجر) — الأوامر تحت مبنية على كده.
- دومين اسمه مشاور (A Record) على الـ IP بتاع الـ VPS.

### 1.1 تثبيت Docker (لو مش متثبت)

اتصل بالسيرفر بـ SSH وشغّل:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo apt-get install -y docker-compose-plugin || sudo apt-get install -y docker-compose
```

تأكد إنه اشتغل:

```bash
sudo docker --version
sudo docker compose version   # أو docker-compose --version لو النسخة القديمة
```

> ملحوظة: لو الأمر `docker compose` (بمسافة) مش موجود عندك، استخدم
> `docker-compose` (بشرطة) في كل الأوامر اللي جاية بدل `docker compose`.

---

## 2. رفع الكود على السيرفر

اضغط الملف اللي هبعتهولك (`clinic-saas-deploy.tar.gz`) وارفعه للسيرفر
بأي طريقة تفضّلها:

**عبر SCP من جهازك:**
```bash
scp clinic-saas-deploy.tar.gz root@YOUR_SERVER_IP:/root/
```

**أو عبر File Manager في hPanel** (لو حابب ترفعه من المتصفح مباشرة).

بعدين على السيرفر (عبر SSH):

```bash
cd /root
tar -xzf clinic-saas-deploy.tar.gz
cd clinic-saas
```

---

## 3. إعداد متغيرات البيئة

انسخ ملف الإعدادات وعدّله:

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

عدّل القيم دي:

| المتغير | الوصف |
|---|---|
| `DOMAIN` | الدومين بتاعك، مثال: `clinic.yourdomain.com` |
| `LETSENCRYPT_EMAIL` | إيميلك (لتنبيهات شهادة SSL بس) |
| `DB_PASSWORD` | كلمة سر قوية لقاعدة البيانات — **غيّرها من القيمة الافتراضية** |
| `AUTH_SECRET` | سر عشوائي طويل — ولّده بالأمر: `openssl rand -base64 32` والصقه |

احفظ واخرج (`Ctrl+O` ثم `Enter` ثم `Ctrl+X` في nano).

---

## 4. توجيه الدومين للسيرفر

في لوحة إدارة الدومين (لو الدومين نفسه عند هوستنجر برضه، هتلاقيه في
hPanel → Domains → DNS Zone Editor):

- أضف A Record: `clinic` (أو `@` لو الدومين الرئيسي) يشاور على **IP بتاع الـ VPS**.
- استنى شوية لحد ما الـ DNS ينتشر (ممكن ياخد من دقايق لساعة).

تأكد إنه اتوجّه صح:
```bash
ping clinic.yourdomain.com
```

---

## 5. تشغيل النظام

```bash
sudo docker compose --env-file .env.docker up -d --build
```

(لو `docker compose` مش شغال، استخدم: `sudo docker-compose --env-file .env.docker up -d --build`)

الأمر ده هيعمل:
1. بناء صورة Docker للتطبيق.
2. تشغيل قاعدة البيانات PostgreSQL.
3. تطبيق كل الـ migrations تلقائيًا (إنشاء الجداول).
4. تشغيل Caddy واستخراج شهادة SSL تلقائيًا لدومينك.

تابع اللوج للتأكد إن كل حاجة اشتغلت:
```bash
sudo docker compose logs -f
```

(اضغط `Ctrl+C` للخروج من متابعة اللوج، ده مش هيوقف السيستم)

---

## 6. إنشاء أول عيادة حقيقية (بدل بيانات التجربة)

بعد ما السيستم يشتغل، أنشئ حساب العيادة والطبيب الفعليين:

```bash
sudo docker compose exec app node scripts/create-clinic.js \
  --clinic-name="اسم العيادة" \
  --city="المنصورة" \
  --doctor-name="اسم الطبيب" \
  --phone="01xxxxxxxxx" \
  --password="كلمة-سر-قوية-هنا"
```

دلوقتي تقدر تدخل على `https://clinic.yourdomain.com` وتسجّل دخول بالرقم
وكلمة السر دي.

> لو حابب تجرب بسرعة ببيانات وهمية بدل ما تدخل بيانات حقيقية، تقدر
> تشغّل `sudo docker compose exec app node scripts/seed.js` بدل كده
> (بينشئ عيادة تجريبية بحساب طبيب وسكرتارية جاهزين).

---

## 7. أوامر مفيدة للصيانة اليومية

```bash
# شوف حالة الخدمات
sudo docker compose ps

# شوف اللوج (كله أو خدمة معينة)
sudo docker compose logs -f
sudo docker compose logs -f app

# إيقاف السيستم
sudo docker compose down

# تشغيله تاني (من غير إعادة بناء)
sudo docker compose up -d

# بعد أي تحديث للكود (لو رفعت نسخة جديدة)
sudo docker compose up -d --build

# عمل نسخة احتياطية من قاعدة البيانات
sudo docker compose exec db pg_dump -U clinic_app clinic_saas > backup_$(date +%Y%m%d).sql

# استرجاع نسخة احتياطية
cat backup_20260101.sql | sudo docker compose exec -T db psql -U clinic_app -d clinic_saas
```

---

## 8. ملاحظات مهمة

- **البيانات محفوظة في Docker volumes** (`db_data` لقاعدة البيانات،
  `uploads_data` لصور الأشعة/التحاليل المرفوعة) — بتفضل موجودة حتى لو
  عملت `docker compose down` وشغّلت تاني. الحذف بيحصل بس لو عملت
  `docker compose down -v` (الـ `-v` بيمسح الـ volumes، خليك حذر منه).
- **اعمل نسخة احتياطية دورية** لقاعدة البيانات (الأمر في قسم 7 فوق) —
  ده أهم حاجة لأي بيانات طبية/مالية حقيقية.
- **AUTH_SECRET و DB_PASSWORD** في `.env.docker` سريّين جدًا — متشاركهمش
  مع حد ومتحطهمش في أي مكان عام.
- لو حبيت تضيف طبيب/سكرتيرة تانيين لنفس العيادة، دلوقتي مفيش صفحة UI
  لإدارة المستخدمين (هيتضاف كموديول لاحقًا لو احتجته) — لحد ما نضيفها،
  ينفع تتضاف يدويًا عبر:
  ```bash
  sudo docker compose exec db psql -U clinic_app -d clinic_saas
  ```
  وبعدين INSERT مباشر في جدول `users` (قولّي لو محتاج مساعدة في ده).

---

## 9. لو حصلت مشكلة

| المشكلة | الحل المحتمل |
|---|---|
| الموقع بيدي "Connection refused" | تأكد إن الـ DNS اتوجّه صح (`ping دومينك`)، واستنى شوية لحد ما ينتشر |
| شهادة SSL مش شغالة | تأكد إن بورت 80 و443 مفتوحين في الفايروول بتاع الـ VPS (`sudo ufw allow 80,443/tcp`) |
| `UntrustedHost` error في اللوج | تأكد إن `DOMAIN` في `.env.docker` مطابق تمامًا للدومين اللي بتفتحه في المتصفح |
| السيرفر بيقف فجأة | شوف اللوج (`sudo docker compose logs app`) وابعتلي الخطأ لو محتاج مساعدة |
