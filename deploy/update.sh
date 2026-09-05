#!/usr/bin/env bash
# Обновление приложения на сервере.
# Запускать на сервере, от пользователя booking (или sudo -u booking).
# Установка:
#   sudo cp deploy/update.sh /usr/local/bin/booking-update
#   sudo chmod +x /usr/local/bin/booking-update
# Запуск:
#   sudo -u booking /usr/local/bin/booking-update
#   sudo systemctl restart booking
#
# Скрипт можно запускать без sudo, если выполняется от пользователя booking
# и есть право на restart systemd-сервиса (см. README ниже).

set -euo pipefail

APP_DIR="/srv/booking"
cd "$APP_DIR"

echo "==> Pulling git changes"
git fetch origin main
git merge --ff-only origin/main

# Устанавливаем зависимости также при повторной попытке после сбоя.
npm ci --include=dev --no-audit --no-fund

# Если есть новые миграции — накатим
echo "==> Applying Prisma migrations (no-op if up to date)"
npx prisma migrate deploy
npx prisma generate

echo "==> Building Next.js"
npm run build

echo
echo "Готово. Перезапустите сервис:"
echo "  sudo systemctl restart booking"
