#!/usr/bin/env bash
# Бэкап БД + папки uploads. Запускается из cron от root или booking.
#
# Установка:
#   sudo cp deploy/backup.sh /usr/local/bin/booking-backup
#   sudo chmod +x /usr/local/bin/booking-backup
#   sudo crontab -e
#     30 3 * * * /usr/local/bin/booking-backup
#
# Хранит 14 последних дампов и 7 последних tar uploads.

set -e

BACKUP_DIR="/var/backups/booking"
DB_NAME="hotel_booking"
DB_USER="booking"
APP_DIR="/srv/booking"

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/uploads"

STAMP=$(date +%Y%m%d-%H%M%S)

# 1. Дамп БД
PGPASSWORD="$(grep '^DATABASE_URL' "$APP_DIR/.env" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|')" \
  pg_dump -h localhost -U "$DB_USER" -F c "$DB_NAME" \
  > "$BACKUP_DIR/db/${DB_NAME}_${STAMP}.dump"

# 2. Архив uploads
if [ -d "$APP_DIR/public/uploads" ]; then
  tar czf "$BACKUP_DIR/uploads/uploads_${STAMP}.tar.gz" \
    -C "$APP_DIR/public" uploads
fi

# 3. Ротация
find "$BACKUP_DIR/db" -name "*.dump" -mtime +14 -delete
find "$BACKUP_DIR/uploads" -name "*.tar.gz" -mtime +7 -delete

echo "Backup done: $STAMP"
