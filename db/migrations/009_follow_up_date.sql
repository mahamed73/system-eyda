-- Migration 009: ميزة تذكير المتابعة
-- خانة "تاريخ المتابعة" اللي الطبيب يكتبها أثناء الكشف، والنظام يستخدمها
-- لإنشاء تذكيرات للسكرتارية (تأخر/اليوم/قريبًا).

ALTER TABLE visits
    ADD COLUMN IF NOT EXISTS follow_up_date DATE;
