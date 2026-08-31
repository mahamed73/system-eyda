#!/usr/bin/env bash
# سكريبت تجهيز قاعدة البيانات من الصفر (Idempotent).
# لازم تشغله بصلاحيات sudo. يستخدم في بيئة التطوير المحلية فقط.
#
# الاستخدام:
#   bash scripts/setup-db.sh

set -euo pipefail

echo "▶️  تثبيت PostgreSQL (لو مش متثبت)..."
if ! command -v psql >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y postgresql postgresql-contrib
fi

echo "▶️  تشغيل خدمة PostgreSQL..."
sudo service postgresql start
sleep 2

echo "▶️  إنشاء الـ Role و الـ Database (لو مش موجودين)..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='clinic_app'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE clinic_app LOGIN PASSWORD 'clinic_app_pw';"

sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='clinic_saas'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE clinic_saas OWNER clinic_app;"

sudo -u postgres psql -d clinic_saas -c "GRANT ALL PRIVILEGES ON DATABASE clinic_saas TO clinic_app;"
sudo -u postgres psql -d clinic_saas -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
sudo -u postgres psql -d clinic_saas -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

echo "▶️  تطبيق الـ Migrations..."
node "$(dirname "$0")/migrate.js"

echo "✅ الداتابيز جاهزة. لو محتاج بيانات تجريبية شغّل: node scripts/seed.js"
