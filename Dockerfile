# syntax=docker/dockerfile:1

# ==========================================================
# Dockerfile للإنتاج — Multi-stage build لتطبيق Next.js (standalone output)
# مناسب لأي VPS عليه Docker (زي Hostinger VPS)
# ==========================================================

# ---- 1) تثبيت الاعتماديات الكاملة (للـ build فقط) ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2) تثبيت اعتماديات الإنتاج فقط (هتتنسخ للـ runner) ----
FROM node:20-alpine AS deps-prod
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- 3) بناء التطبيق ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next.config.ts فيه output: "standalone"
RUN npm run build

# ---- 4) صورة التشغيل النهائية (خفيفة) ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# توقيت القاهرة — ضروري لحسابات أيام الدور والحجز الأونلاين
ENV TZ=Africa/Cairo

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# ملفات تشغيل Next.js (standalone) + الملفات الثابتة
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# استبدال node_modules المُختصرة بنسخة كاملة من اعتماديات الإنتاج،
# عشان سكريبتات migrate.js/seed.js/create-clinic.js تلاقي كل حاجة
# (pg, bcryptjs, dotenv...) لأنها بتتشغل بره الـ Next.js bundle نفسه.
COPY --from=deps-prod /app/node_modules ./node_modules

# ملفات الـ migrations والسكريبتات
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/demo-config.json ./demo-config.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN mkdir -p storage/uploads \
    && chown -R nextjs:nodejs storage db /app \
    && chmod +x docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
