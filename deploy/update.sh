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

set -e

APP_DIR="/srv/booking"
cd "$APP_DIR"

echo "==> Pulling git changes"
git fetch --all
git reset --hard origin/main

# Если изменился package.json — переустановим зависимости
if git diff --name-only HEAD@{1} HEAD 2>/dev/null | grep -q "^package\(-lock\)\?\.json$"; then
  echo "==> package.json changed — npm ci"
  npm ci --no-audit --no-fund
fi

# Если есть новые миграции — накатим
echo "==> Applying Prisma migrations (no-op if up to date)"
npx prisma migrate deploy
npx prisma generate

echo "==> Building Next.js"
npm run build

echo
echo "Готово. Перезапустите сервис:"
echo "  sudo systemctl restart booking"
