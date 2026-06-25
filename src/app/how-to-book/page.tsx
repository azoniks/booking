import Link from "next/link";
import { ArrowLeft, MousePointerClick, CalendarDays, Users, CreditCard, Mail, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Как забронировать",
  description: "Пошаговая инструкция по онлайн-бронированию",
};

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: React.ReactNode;
  image?: { src: string; alt: string };
};

const STEPS: Step[] = [
  {
    icon: MousePointerClick,
    title: "Выберите объект",
    body: (
      <>
        На главной странице выберите нужную категорию во вкладках сверху
        (например, «Номера», «Беседки»), затем подходящий объект и нажмите
        <strong> «Забронировать»</strong>. Откроется карточка объекта с формой
        бронирования.
      </>
    ),
    image: { src: "/how-to-book/01-catalog.png", alt: "Каталог объектов" },
  },
  {
    icon: CalendarDays,
    title: "Выберите дату и время",
    body: (
      <>
        В блоке «Бронирование» выберите даты в календаре. В зависимости от
        объекта это могут быть: <strong>даты заезда и выезда</strong> (посуточно),
        <strong> интервал времени или готовый слот</strong> (почасовая аренда) или
        <strong> один день целиком</strong>. Выбранное отразится в блоке
        «Ваш выбор», а рядом сразу посчитается стоимость.
      </>
    ),
    image: { src: "/how-to-book/02-booking.png", alt: "Форма бронирования: календарь, гости, контакты" },
  },
  {
    icon: Users,
    title: "Укажите гостей и контактные данные",
    body: (
      <>
        Введите число гостей, <strong>ФИО</strong>, <strong>email</strong> и
        <strong> телефон</strong>. Телефон обязателен и должен быть указан
        полностью в формате <em>+7 (XXX) XXX-XX-XX</em> — на эту почту и номер
        придут подтверждение и уведомления о брони. При желании добавьте
        комментарий.
      </>
    ),
  },
  {
    icon: CreditCard,
    title: "Согласие и оплата",
    body: (
      <>
        Поставьте галочку согласия на обработку персональных данных и нажмите
        <strong> «Забронировать и оплатить»</strong>. Откроется защищённая
        страница оплаты банка. Для многих объектов онлайн вносится только
        <strong> предоплата (аванс)</strong>, а остаток оплачивается на месте —
        суммы видны в блоке оплаты до перехода.
      </>
    ),
  },
  {
    icon: Mail,
    title: "Подтверждение",
    body: (
      <>
        После успешной оплаты бронь подтверждается, и вам на почту приходит
        письмо с деталями. <strong>Важно:</strong> на оплату даётся ограниченное
        время — если не оплатить, бронь автоматически отменится. Сразу после
        создания брони мы также присылаем <strong>письмо со ссылкой на оплату</strong> —
        по ней можно вернуться и оплатить, даже если вы случайно закрыли вкладку.
      </>
    ),
  },
  {
    icon: ShoppingCart,
    title: "Несколько объектов сразу",
    body: (
      <>
        Хотите забронировать несколько объектов одним заказом? На карточке
        объекта выберите даты и нажмите <strong>«Добавить в корзину»</strong>,
        затем перейдите в корзину, добавьте остальные объекты и оформите всё
        вместе с одной оплатой.
      </>
    ),
    image: { src: "/how-to-book/04-cart.png", alt: "Корзина — оформление нескольких объектов" },
  },
];

export default function HowToBookPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="container py-4">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> На главную
          </Link>
        </div>
      </header>

      <main className="container max-w-3xl py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Как забронировать
          </h1>
          <p className="text-muted-foreground">
            Онлайн-бронирование занимает пару минут. Ниже — пошаговая инструкция.
          </p>
        </div>

        <ol className="space-y-8">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={i}
                className="rounded-xl border bg-white p-5 sm:p-6 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                      <Icon className="w-5 h-5 text-primary shrink-0" />
                      {step.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                      {step.body}
                    </p>
                    {step.image && (
                      <figure className="mt-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={step.image.src}
                          alt={step.image.alt}
                          loading="lazy"
                          className="w-full rounded-lg border bg-slate-50"
                        />
                        <figcaption className="mt-1.5 text-xs text-muted-foreground">
                          {step.image.alt}
                        </figcaption>
                      </figure>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Памятка */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <div className="font-semibold mb-1">Коротко о важном</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>Телефон и email указывайте корректно — на них приходят подтверждение и уведомления.</li>
            <li>Оплатить бронь нужно в течение отведённого времени, иначе она автоматически отменится.</li>
            <li>Если закрыли вкладку оплаты — воспользуйтесь ссылкой из письма, которое пришло при создании брони.</li>
            <li>По многим объектам онлайн вносится только аванс, остаток оплачивается на месте.</li>
          </ul>
        </div>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Перейти к выбору объектов
          </Link>
        </div>
      </main>

      <footer className="border-t py-6 bg-white">
        <div className="container text-center text-sm text-muted-foreground">
          Остались вопросы? Свяжитесь с нами — поможем с бронированием.
        </div>
      </footer>
    </div>
  );
}
