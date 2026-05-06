# Hotel/SPA booking system

Полноценная система бронирования: номера (посуточно), СПА, беседки и мостики для рыбалки (по часам). Включает админку и адаптивную клиентскую часть.

## Стек

- **Next.js 15** (App Router, RSC) + **TypeScript**
- **PostgreSQL 16** + **Prisma 5**
- **Tailwind CSS** + shadcn/ui-стиль (Radix Primitives)
- **NextAuth v5 (Auth.js)** — авторизация админов
- **Tinkoff Acquiring** (mock-режим в dev)
- **nodemailer** + **Telegram Bot API** для уведомлений
- **Vitest** для тестов

## Возможности

**Клиент:**
- Главная с вкладками по категориям (порядок и видимость задаются в админке)
- Карточки объектов с фото/видео
- Адаптивная вёрстка (mobile-first)
- Выбор дат для номеров, дат+часов для остальных
- Гостевая бронь без регистрации
- Расчёт цены и доплата за допместо
- Проверка доступности до создания брони
- Редирект на оплату Tinkoff (или mock в dev)

**Админка:**
- Категории (вкладки) — CRUD с порядком
- Типы объектов — настройки времени, шага, рабочих часов, уборки, цены
- Объекты — CRUD + загрузка медиа (фото/видео)
- Брони — список с фильтрами и детальной карточкой
- Ручные блокировки объекта (ремонт)
- Настройки сайта (название, контакты, email админов)
- Управление администраторами

**Бэкенд:**
- Транзакция `Serializable` при создании брони — защита от race condition
- Денормализация `blockedUntil = endAt + cleaningMinutes` для быстрого поиска пересечений
- Cron-подобный планировщик (через `instrumentation.ts`):
  - каждую минуту отменяет PENDING-брони старше 15 мин
  - каждый час шлёт напоминания за 24ч до брони
- Хранение в UTC, отображение в Europe/Moscow

## Быстрый старт

### Требования

- macOS / Linux
- **Node.js ≥ 20** (`brew install node@20`)
- **PostgreSQL ≥ 16** (`brew install postgresql@16 && brew services start postgresql@16`)

### Установка

```bash
git clone <repo>
cd hotel-booking
cp .env.example .env       # отредактируй DATABASE_URL под себя
bash scripts/setup.sh      # ставит зависимости, накатывает миграции, заполняет демо-данными
npm run dev
```

Открыть:
- http://localhost:3000 — клиентская часть
- http://localhost:3000/admin/login — админка

Логин по умолчанию: `admin@example.com / admin123`

### Сценарий проверки

1. На главной кликнуть вкладку **Беседки** → карточка «Беседка №1»
2. Выбрать дату и часы → «Проверить доступность» → «Свободно ✓»
3. Заполнить ФИО/email/телефон → «Забронировать и оплатить»
4. Откроется страница mock-оплаты → «Оплатить» → редирект на success
5. Зайти в админку → дашборд показывает свежую бронь как PAID
6. В консоли `npm run dev` видно email-уведомления

## Структура проекта

```
prisma/
  schema.prisma             # БД
  seed.ts                   # демо-данные
src/
  app/
    page.tsx                # главная клиента
    booking/                # форма брони, success/failed
    admin/
      login/
      (panel)/              # авторизованные страницы (sidebar layout)
    api/
      auth/...              # NextAuth handlers
      public/...            # API клиента (categories, availability, bookings)
      admin/...             # CRUD-роуты админки
      payments/...          # Tinkoff init/webhook + mock-confirm
  components/
    client/                 # CategoryTabs, ObjectCard, BookingForm
    admin/                  # CategoriesManager, ObjectEditor, …
    ui/                     # shadcn-компоненты
  lib/
    db.ts                   # Prisma singleton
    auth.ts / auth.config.ts # node + edge auth
    availability.ts         # пересечения броней
    pricing.ts              # расчёт стоимости
    booking-service.ts      # транзакция создания брони
    tinkoff.ts              # Tinkoff API + mock
    notifications/          # email + telegram
    scheduler.ts            # background tasks
    time.ts                 # UTC ↔ MSK
    validators/             # zod-схемы
  middleware.ts             # защита /admin/*
tests/
  availability.test.ts
  pricing.test.ts
  booking-service.test.ts   # с реальной БД (hotel_booking_test)
  time.test.ts
instrumentation.ts          # стартует scheduler
```

## Команды

```bash
npm run dev               # dev-сервер на :3000
npm run build             # production build
npm run start             # запуск продакшен-сборки
npm run test              # vitest (26 тестов)
npm run lint              # ESLint
npm run db:migrate        # prisma migrate dev
npm run db:reset          # сбросить БД и засеять заново
npm run db:seed           # только seed
```

## Конфигурация (.env)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | строка подключения к PostgreSQL |
| `DATABASE_URL_TEST` | отдельная БД для тестов booking-service |
| `AUTH_SECRET` | секрет для NextAuth (≥ 16 символов) |
| `APP_URL` | базовый URL (для генерации ссылок) |
| `APP_TIMEZONE` | по умолчанию `Europe/Moscow` |
| `PAYMENT_TIMEOUT_MINUTES` | через сколько отменять PENDING-брони (15) |
| `TINKOFF_TEST_MODE` | `true` = mock, `false` = реальный Tinkoff |
| `TINKOFF_TERMINAL_KEY`, `TINKOFF_PASSWORD` | креды Tinkoff |
| `MOCK_PAYMENT_SECRET` | секрет HMAC для mock-confirm |
| `SMTP_*` | SMTP. Если `SMTP_HOST` пуст — письма пишутся в консоль |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` | опционально |

## Включить реальный Tinkoff

1. В личном кабинете Tinkoff получить TerminalKey и Password (тестовый или боевой)
2. В `.env`:
   ```
   TINKOFF_TEST_MODE=false
   TINKOFF_TERMINAL_KEY=...
   TINKOFF_PASSWORD=...
   ```
3. Webhook URL: `https://yourdomain/api/payments/tinkoff/webhook`. Для локальной отладки — `ngrok http 3000`
4. В кабинете Tinkoff указать NotificationURL

## Тесты

```
✓ tests/availability.test.ts    (5)  — логика пересечений
✓ tests/pricing.test.ts         (6)  — DAILY/HOURLY, допгости
✓ tests/time.test.ts            (3)  — UTC ↔ MSK
✓ tests/booking-service.test.ts (12) — конфликт, уборка, race condition, cancel
                                  ─
                                 26 passed
```

`booking-service.test.ts` использует реальную БД `hotel_booking_test`. Перед первым запуском убедись что эта БД создана (setup.sh делает это автоматически).

## Заметки по архитектуре

- **Race condition.** При создании брони используется `prisma.$transaction(fn, { isolationLevel: 'Serializable' })`. Внутри транзакции повторно ищем пересечения и кидаем `BookingConflictError` если они появились между проверкой и записью. Тест `параллельные брони одновременно` подтверждает, что из двух одновременных запросов проходит только один.
- **`blockedUntil`.** Денормализован при создании брони: `endAt + cleaningMinutes`. Один индекс `(objectId, startAt, blockedUntil)` закрывает все запросы поиска пересечений как для дневных, так и для часовых объектов.
- **Snapshot цены.** В таблице `Booking` хранятся `basePrice/extraGuestsCost/totalPrice` на момент брони — изменение тарифа в админке не пересчитывает старые брони.
- **Auth split.** `auth.config.ts` — edge-safe конфиг (без bcrypt и Prisma) для middleware. `auth.ts` — полная конфигурация с Credentials + bcrypt. NextAuth v5 рекомендует именно такое разделение.
- **Scheduler.** Запускается через `instrumentation.ts` (Next 15 hook), `setInterval` в node-runtime. На проде заменить на cron / systemd-timer.

## Чего нет (отложено)

- Сезонные тарифы и промокоды
- Регистрация клиентов и личный кабинет
- SMS-уведомления
- Многоязычность (только русский)
- Возвраты через UI админки (только смена статуса)
- Деплой-скрипты (CI/CD, docker, nginx)
