#!/bin/sh
# بيتشغل مرة واحدة عند بدء الـ container: يطبّق أي migration جديدة
# (idempotent — بيتجاهل اللي اتطبق قبل كده)، وبعدين يشغّل السيرفر.
set -e

echo "▶️  تطبيق الـ migrations..."
node scripts/migrate.js

echo "▶️  تجهيز بيانات النسخة التجريبية (Demo)..."
node scripts/seed-demo.js || echo "⚠️  تحذير: تعذّر تجهيز بيانات الديمو (مش هيمنع التشغيل)"

echo "▶️  تشغيل السيرفر..."
exec "$@"
