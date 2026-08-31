#!/usr/bin/env bash
# ============================================================
# سكريبت النشر على الـ VPS — شغّله على السيرفر نفسه بـ root.
# آمن لإعادة التشغيل (idempotent): كل مرة بيجيب أحدث كود من GitHub
# ويعيد البناء. البيانات بتفضل محفوظة في Docker volumes.
#
# الاستخدام:
#   مع دومين:    DOMAIN=clinic.example.com bash scripts/deploy.sh
#   بدون دومين:  bash scripts/deploy.sh   (هيفتح الموقع على بورت 80 بالـ IP)
# ============================================================
set -euo pipefail

REPO_URL="https://github.com/mahamed73/system-eyda.git"
APP_DIR="/opt/clinic-saas"
SERVER_IP="$(curl -s https://api.ipify.org || echo '')"

echo "==> 1) تثبيت Docker لو مش موجود"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker --version

echo "==> 2) جلب الكود من GitHub"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main

echo "==> 3) ملف الإعدادات (.env.docker)"
if [ ! -f .env.docker ]; then
  RANDOM_SECRET="$(openssl rand -hex 32)"
  if [ -n "${DOMAIN:-}" ]; then
    NEXTAUTH_URL="https://${DOMAIN}"
  else
    NEXTAUTH_URL="http://${SERVER_IP}"
    DOMAIN=""
  fi
  cat > .env.docker <<EOF
DOMAIN=${DOMAIN}
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL:-admin@${DOMAIN:-example.com}}
DB_PASSWORD=${RANDOM_SECRET}
AUTH_SECRET=${RANDOM_SECRET}
NEXTAUTH_URL=${NEXTAUTH_URL}
EOF
  echo "تم إنشاء .env.docker"
fi
# دايًا نحدّث NEXTAUTH_URL حسب وجود دومين (من غير ما نلمس الأسرار)
if [ -n "${DOMAIN:-}" ]; then
  grep -q '^NEXTAUTH_URL=' .env.docker || echo "NEXTAUTH_URL=https://${DOMAIN}" >> .env.docker
fi

echo "==> 4) وضع التشغيل (دومين = Caddy+SSL / IP = بورت 80 مباشر)"
if [ -n "${DOMAIN:-}" ]; then
  rm -f docker-compose.override.yml
  PROFILE_ARG="--profile web"
else
  cat > docker-compose.override.yml <<'YAML'
services:
  app:
    ports:
      - "80:3000"
YAML
  # نخلّي Caddy بره (مفيش دومين)
  PROFILE_ARG=""
fi

echo "==> 5) بناء وتشغيل الحاويات"
if docker compose version >/dev/null 2>&1; then
  DC="docker compose --env-file .env.docker"
else
  DC="docker-compose --env-file .env.docker"
fi
$DC $PROFILE_ARG up -d --build --remove-orphans

echo "==> 6) متابعة حالة الخدمات"
sleep 10
$DC $PROFILE_ARG ps || true

echo "==> 7) فحص التطبيق"
OK=0
for i in $(seq 1 30); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' http://localhost/api/health || true)"
  echo "محاولة $i: HTTP $CODE"
  if [ "$CODE" = "200" ]; then OK=1; break; fi
  sleep 6
done

if [ "$OK" = "1" ]; then
  echo ""
  echo "✅ تم النشر بنجاح!"
  if [ -n "${DOMAIN:-}" ]; then
    echo "   النظام:        https://${DOMAIN}"
    echo "   صفحة الحجز:    https://${DOMAIN}/b/<slug>"
  else
    echo "   النظام:        http://${SERVER_IP}"
    echo "   صفحة الحجز:    http://${SERVER_IP}/b/<slug>"
  fi
  echo ""
  echo "   للتحديثات المستقبلية شغّل نفس الأمر تاني، والبيانات بتفضل محفوظة."
else
  echo "❌ التطبيق مش بيرد بـ 200 — آخر لوج:"
  $DC $PROFILE_ARG logs --tail=60 app || true
  exit 1
fi
