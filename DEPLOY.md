# Деплой на VDS (Ubuntu 22.04+)

Пошаговая инструкция от покупки сервера до работающего сайта на HTTPS.
Подходит для **Timeweb Cloud / Selectel / Beget VPS / Reg.ru VPS** и любых других
с Ubuntu/Debian.

Все команды выполняются на сервере, если не указано иначе.

---

## 0. Что нужно купить

- **VDS**: 2 ГБ RAM, 1–2 vCPU, 20 ГБ диска. ~250–400 ₽/мес.
  - Рекомендую Ubuntu 22.04 LTS или 24.04 LTS.
- **Домен** (например, `booking.example.ru`). Привяжите A-запись на IP сервера.
- (опционально) **SMTP** для писем — Yandex 360 для бизнеса, Mail.ru, SendPulse.

---

## 1. Подключиться к серверу

С локальной машины:

```bash
ssh root@<IP-сервера>
```

Сразу обновить систему:

```bash
apt update && apt upgrade -y
apt install -y curl git ufw fail2ban
```

Включить firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## 2. Установить Node.js 20 и PostgreSQL 16

```bash
# Node.js 20 (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

node --version   # v20.x
npm --version

# PostgreSQL 16
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql

psql --version   # psql (PostgreSQL) 16.x
```

---

## 3. Установить Caddy (HTTPS reverse-proxy)

Caddy сам выпустит и продлит сертификат Let's Encrypt — никаких certbot.

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy
```

---

## 4. Создать пользователя и БД

```bash
# системный пользователь для приложения (без shell-доступа)
adduser --system --group --shell /usr/sbin/nologin --home /srv/booking booking
mkdir -p /srv/booking
chown booking:booking /srv/booking

# создать пользователя БД и саму базу
sudo -u postgres psql <<EOF
CREATE USER booking WITH PASSWORD 'СГЕНЕРИРУЙТЕ_СИЛЬНЫЙ_ПАРОЛЬ';
CREATE DATABASE hotel_booking OWNER booking;
GRANT ALL PRIVILEGES ON DATABASE hotel_booking TO booking;
EOF
```

Сильный пароль сгенерировать: `openssl rand -base64 24`. Запишите — он пойдёт в `.env`.

---

## 5. Получить код приложения

Если код в git-репозитории (рекомендую):

```bash
cd /srv
sudo -u booking git clone https://github.com/your/repo.git booking
cd /srv/booking
```

Или загрузить локально архивом:

```bash
# на локальной машине
tar czf booking.tar.gz --exclude=node_modules --exclude=.next --exclude=.env --exclude=public/uploads /Users/azoniks/Projects/hotel-booking
scp booking.tar.gz root@<IP>:/tmp/

# на сервере
cd /srv && tar xzf /tmp/booking.tar.gz && mv hotel-booking booking
chown -R booking:booking /srv/booking
```

---

## 6. Настроить `.env`

```bash
cd /srv/booking
sudo -u booking cp deploy/.env.production.example .env
sudo -u booking nano .env
```

Заполнить минимум:

- `DATABASE_URL` — с паролем из шага 4
- `AUTH_SECRET` — `openssl rand -base64 48`
- `AUTH_URL`, `APP_URL` — `https://booking.example.ru`
- `MOCK_PAYMENT_SECRET` — `openssl rand -hex 32`
- SMTP — если у вас уже есть почтовый сервис

Закрыть файл от чужих:

```bash
chmod 600 /srv/booking/.env
chown booking:booking /srv/booking/.env
```

---

## 7. Установить зависимости и накатить миграции

```bash
cd /srv/booking
sudo -u booking npm ci --no-audit --no-fund
sudo -u booking npx prisma migrate deploy
sudo -u booking npx prisma generate

# первоначальный seed: создаст админа admin@example.com / admin123
# — после первого входа смените пароль в админке!
sudo -u booking npm run db:seed
```

---

## 8. Собрать приложение

```bash
sudo -u booking npm run build
```

Сборка занимает 1–2 минуты. Результат в `.next/`.

---

## 9. Настроить systemd

```bash
cp /srv/booking/deploy/booking.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now booking
```

Проверить:

```bash
systemctl status booking
journalctl -u booking -f          # просмотр логов в реальном времени
curl http://127.0.0.1:3000/       # приложение должно ответить HTML
```

Если что-то не работает — смотри `journalctl -u booking -n 100`.

---

## 10. Настроить Caddy

```bash
cp /srv/booking/deploy/Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile        # заменить booking.example.ru на ваш домен
systemctl reload caddy
```

Caddy автоматически:
- получит сертификат Let's Encrypt (за 30–60 сек после первого запроса);
- настроит редирект HTTP → HTTPS;
- будет проксировать на `localhost:3000`.

Откройте `https://booking.example.ru` в браузере — должна открыться главная.

---

## 11. Войти в админку и поменять пароль

```
https://booking.example.ru/admin/login
admin@example.com / admin123
```

→ Раздел **«Администраторы»** → нажать «Сменить пароль».
→ Раздел **«Настройки»** — заполнить SMTP / Tinkoff / Telegram / MAX.

### Tinkoff

В админке: режим = `production` (или `test`), вставить TerminalKey/Password от Тинькофф. После сохранения в личном кабинете Тинькофф указать webhook:
```
https://booking.example.ru/api/payments/tinkoff/webhook
```

### Telegram / MAX

Создать ботов (через `@BotFather` для TG, `@MasterBot` для MAX), вставить токен и username в админке.
Нажать **«Установить webhook»** во вкладке «Клиенту» — Caddy уже даёт публичный HTTPS.

---

## 12. Бэкапы

```bash
cp /srv/booking/deploy/backup.sh /usr/local/bin/booking-backup
chmod +x /usr/local/bin/booking-backup

# крон от root, каждый день в 03:30
crontab -e
```

Добавить:
```
30 3 * * * /usr/local/bin/booking-backup >> /var/log/booking-backup.log 2>&1
```

Проверить вручную:
```bash
/usr/local/bin/booking-backup
ls -la /var/backups/booking/db /var/backups/booking/uploads
```

Для надёжности — копируйте дампы в S3-хранилище (Selectel/Yandex Object Storage). Минимально:
```bash
apt install -y rclone
rclone config            # настроить remote
# и в backup.sh добавить: rclone copy /var/backups/booking remote:bucket/booking
```

---

## 13. Обновление версии

В админке: **Настройки → Обновление сайта → Обновить и задеплоить из Git**.
Кнопка запускает существующий `deploy/update.sh` в отдельном systemd-сервисе,
затем перезапускает `booking`. Страница проверяет результат каждые 5 секунд.
Повторный запуск блокируется до завершения. Обновление может временно прервать
доступ к сайту, поскольку сборка выполняется в рабочем каталоге.

Для включения кнопки один раз установите файлы из этой версии проекта
на сервере от root (саму версию с кнопкой сначала разверните обычным способом):

```bash
install -d -o booking -g booking -m 700 /srv/booking/.deploy
install -d -o root -g root -m 755 /usr/local/lib/booking
install -o root -g root -m 755 /srv/booking/deploy/update.sh /usr/local/lib/booking/update.sh
install -o root -g root -m 755 /srv/booking/deploy/run-update.sh /usr/local/lib/booking/run-update.sh
install -m 644 /srv/booking/deploy/booking-update.service /etc/systemd/system/booking-update.service
install -m 644 /srv/booking/deploy/booking-update.path /etc/systemd/system/booking-update.path
systemctl daemon-reload
systemctl enable --now booking-update.path
sudo -u booking touch /srv/booking/.deploy/enabled
```

Git-доступ к `origin/main` должен работать у пользователя `booking` без запроса
пароля. Скрипт использует `git merge --ff-only`: при расхождении веток он завершится
с ошибкой без принудительного сброса локальных изменений. Задайте `APP_URL` или
`AUTH_URL` равным публичному адресу сайта для проверки источника запроса.
Веб-приложению не нужны sudo-права: оно создаёт только файл запроса, а systemd
выполняет фиксированную задачу. Скрипты и сборка работают от `booking`; отдельный
шаг systemd перезапускает только `booking.service` с правами root.

Диагностика:

```bash
systemctl status booking-update.path booking-update.service
journalctl -u booking-update.service -n 100
tail -n 100 /srv/booking/.deploy/update.log
```

После изменения файлов в `deploy/` повторите их установку. Перед обновлением
рекомендуется иметь актуальную резервную копию БД: миграции автоматически не
откатываются при ошибке сборки. При отключении питания файл запроса сохраняется,
и включённый path-сервис повторит обновление при загрузке сервера.

Ручное обновление:

```bash
cd /srv/booking
sudo -u booking git pull
sudo -u booking npm ci --no-audit --no-fund
sudo -u booking npx prisma migrate deploy
sudo -u booking npm run build
systemctl restart booking
```

---

## Чеклист после первого деплоя

- [ ] Открывается главная на HTTPS
- [ ] Сменён пароль админа
- [ ] Заполнены SMTP в админке (или в .env), отправлено тестовое письмо
- [ ] Заполнены Tinkoff-ключи, в Тинькофф-кабинете указан webhook URL
- [ ] (опц.) Telegram/MAX боты созданы, webhook установлен
- [ ] `pg_dump` и архив uploads появились в `/var/backups/booking`
- [ ] `journalctl -u booking` без красных ошибок
- [ ] Файрвол: открыты только 22, 80, 443

---

## Типичные проблемы

| Симптом | Причина | Решение |
|---|---|---|
| `502 Bad Gateway` от Caddy | Приложение не запустилось | `journalctl -u booking -n 100` |
| `Prisma error: Can't reach database` | Неверный DATABASE_URL или БД не создана | Проверить пароль / `sudo -u postgres psql -l` |
| Tinkoff `Invalid token` | TerminalKey/Password перепутаны test/prod | Перепроверить в админке |
| Telegram «webhook не работает» | Domain без HTTPS / неверный URL | Caddy должен показывать «certificate obtained» в логе |
| `EADDRINUSE :3000` | Уже запущен другой процесс | `lsof -i :3000` и убить или поменять PORT в systemd |

---

## Что не входит в этот деплой (но стоит сделать позже)

1. **S3-совместимое хранилище для uploads** — сейчас файлы лежат на диске сервера. При смене сервера придётся переносить вручную. Selectel/Yandex Object Storage — ~10 ₽/ГБ/мес.
2. **Cron для scheduler** вместо `setInterval`. Сейчас scheduler запускается внутри Node-процесса; при рестарте теряется до минуты. Для prod можно вынести в системный cron.
3. **Мониторинг** — Uptime Kuma, healthchecks.io.
4. **CI/CD** — GitHub Actions с auto-deploy по push в main.
