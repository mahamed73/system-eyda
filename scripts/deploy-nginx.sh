#!/usr/bin/env bash
# ============================================================
# نشر نظام العيادات على سيرفر شغال فيه موقع تاني بـ nginx.
# الفكرة: النظام يشتغل في Docker على بورت داخلي 3000 (مش بيباصي
# 80/443 خالص)، وnginx الموجود على السيرفر يوجّه دومين العيادة
# ليه، وشهادة HTTPS بتتطلّع تلقائيًا بـ certbot.
# الموقع القديم يفضل شغال زي ما هو من غير أي تعارض.
#
# التشغيل:
#   DOMAIN=clinic1.easychat.cloud bash scripts/deploy-nginx.sh
# ============================================================
set -euo pipefail

REPO_URL="https://github.com/mahamed73/system-eyda.git"
APP_DIR="/opt/clinic-saas"
DOMAIN="${DOMAIN:-clinic1.easychat.cloud}"
INTERNAL_PORT=3000

echo "==> 1) تثبيت Docker لو مش موجود"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker --version

echo "==> 2) تجهيز nginx و certbot"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx certbot python3-certbot-nginx
systemctl enable --now nginx
# مفيش Apache/Caddy تانيين ياخدوا البورتات
systemctl disable --now caddy 2>/dev/null || true

echo "==> 3) جلب/تحديث الكود"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
git fetch origin main
git reset --hard origin/main

echo "==> 4) ملف الإعدادات"
if [ ! -f .env.docker ]; then
  RANDOM_SECRET="$(openssl rand -hex 32)"
  cat > .env.docker <<EOF
DOMAIN=${DOMAIN}
LETSENCRYPT_EMAIL=admin@${DOMAIN}
DB_PASSWORD=${RANDOM_SECRET}
AUTH_SECRET=${RANDOM_SECRET}
NEXTAUTH_URL=https://${DOMAIN}
EOF
fi

echo "==> 5) ربط التطبيق على بورت داخلي 127.0.0.1:${INTERNAL_PORT} فقط"
cat > docker-compose.override.yml <<YAML
services:
  app:
    ports:
      - "127.0.0.1:${INTERNAL_PORT}:3000"
YAML

echo "==> 6) تشغيل قاعدة البيانات والتطبيق (من غير Caddy)"
if docker compose version >/dev/null 2>&1; then
  DC="docker compose --env-file .env.docker"
else
  DC="docker-compose --env-file .env.docker"
fi
$DC up -d --build db app

echo "==> 7) إعداد nginx للدومين"
cat > /etc/nginx/sites-available/clinic-saas <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name __DOMAIN__;
    client_max_body_size 15M;

    location / {
        proxy_pass http://127.0.0.1:__PORT__;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
NGINX
sed -i "s/__DOMAIN__/${DOMAIN}/g; s/__PORT__/${INTERNAL_PORT}/g" /etc/nginx/sites-available/clinic-saas
ln -sf /etc/nginx/sites-available/clinic-saas /etc/nginx/sites-enabled/clinic-saas
nginx -t
systemctl reload nginx

echo "==> 8) استنى التطبيق يجهز"
OK=0
for i in $(seq 1 40); do
  CODE="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${INTERNAL_PORT}/api/health || true)"
  echo "محاولة $i (داخلي): HTTP $CODE"
  if [ "$CODE" = "200" ]; then OK=1; break; fi
  sleep 6
done
[ "$OK" = "1" ] || { echo "❌ التطبيق مش بيرد داخليًا — اللوج:"; $DC logs --tail=60 app; exit 1; }

echo "==> 9) إصدار شهادة HTTPS للدومين"
if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos \
    -m "admin@${DOMAIN}" --redirect || {
      echo "⚠️  تعذّر إصدار الشهادة (اتأكد إن الدومين بيوصل للسيرفر) — الموقع شغال HTTP مؤقتًا"
    }
fi
systemctl reload nginx

echo "==> 10) فحص نهائي عبر HTTPS"
FINAL="$(curl -sk -o /dev/null -w '%{http_code}' https://${DOMAIN}/api/health || true)"
echo "HTTPS health: $FINAL"

echo ""
echo "✅ تم النشر!"
echo "   النظام:      https://${DOMAIN}"
echo "   دخول طبيب:   01001001000 / Demo@2026"
echo "   دخول استقبال: 01002002000 / Demo@2026"
echo "   صفحة الحجز:   https://${DOMAIN}/b/clinic1"
echo "   شاشة الدور:   https://${DOMAIN}/screen/clinic1"
echo ""
echo "   تحديث مستقبلي: شغّل نفس الأمر تاني والبيانات بتفضل محفوظة."
