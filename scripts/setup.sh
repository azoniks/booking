#!/usr/bin/env bash
set -e

# Скрипт первоначальной установки. Требует Node 20+ и PostgreSQL 16+ в PATH.

echo "==> Installing dependencies"
npm install --no-audit --no-fund

echo "==> Creating database (если нет)"
createdb hotel_booking 2>/dev/null || echo "DB hotel_booking already exists"
createdb hotel_booking_test 2>/dev/null || echo "DB hotel_booking_test already exists"

echo "==> Running Prisma migrations"
npx prisma migrate deploy

echo "==> Seeding"
npm run db:seed

echo
echo "Done!"
echo "  npm run dev — запустить (http://localhost:3000)"
echo "  Админка: http://localhost:3000/admin/login (admin@example.com / admin123)"
