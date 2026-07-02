import type { Metadata } from "next";
import { SiteHeader } from "@/components/client/SiteHeader";

export const metadata: Metadata = {
  title: "Отмена брони",
  description: "Как отменить бронирование",
};

export default function CancelBookingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader breadcrumbs={[{ label: "Отмена брони" }]} />

      <main className="container max-w-3xl py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Отмена брони
          </h1>
        </div>

       {/* Intro */}
<p className="text-muted-foreground leading-relaxed">
  Вы можете отменить бронирование в любое время. Условия возврата денежных
  средств зависят от срока, оставшегося до даты заезда, и регулируются
  Гражданским кодексом РФ, Законом РФ «О защите прав потребителей» № 2300-1
  от 07.02.1992 и Правилами предоставления гостиничных услуг в РФ
  (Постановление Правительства РФ № 1085 от 09.10.2015).
</p>

{/* Steps */}
<section className="space-y-4">
  <h2 className="text-xl font-semibold">Как отменить бронирование</h2>
  <ol className="space-y-4 list-none">
    {[
      {
        step: "1",
        title: "Позвоните менеджеру",
        text: "Свяжитесь с нами по телефону в рабочее время. Номер указан на главной странице сайта, в разделе «Контакты».",
      },
      {
        step: "2",
        title: "Назовите данные брони",
        text: "Для идентификации менеджеру потребуется: номер телефона, на который оформлена бронь, даты заезда и выезда, а также название объекта.",
      },
      {
        step: "3",
        title: "Подтвердите отмену",
        text: "Менеджер озвучит условия возврата и зафиксирует отмену. Дата и время звонка считаются датой отмены бронирования.",
      },
      {
        step: "4",
        title: "Дождитесь возврата средств",
        text: "Деньги поступают на карту или счёт, с которого производилась оплата, в сроки, указанные ниже.",
      },
    ].map(({ step, title, text }) => (
      <li key={step} className="flex gap-4">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
          {step}
        </span>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{text}</p>
        </div>
      </li>
    ))}
  </ol>
</section>

{/* Refund table */}
<section className="space-y-4">
  <h2 className="text-xl font-semibold">Условия возврата</h2>
  <p className="text-sm text-muted-foreground">
    В соответствии с п. 28 Правил предоставления гостиничных услуг (ПП РФ
    № 1085) и ст. 32 Закона о защите прав потребителей потребитель вправе
    отказаться от услуги в любой момент, возместив исполнителю фактически
    понесённые расходы.
  </p>

  <div className="overflow-x-auto rounded-xl border">
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-slate-100 text-left">
          <th className="px-4 py-3 font-semibold">До заезда</th>
          <th className="px-4 py-3 font-semibold">Возврат</th>
          <th className="px-4 py-3 font-semibold">Срок зачисления</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {[
          {
            period: "От 3 суток",
            refund: "100 % внесенной предоплаты",
            days: "До 10 рабочих дней",
          },
          {
            period: "Менее 2 суток",
            refund: "Средства не возращаются",
            days: "-",
          },
        ].map((row, i) => (
          <tr key={i} className="even:bg-slate-50">
            <td className="px-4 py-3">{row.period}</td>
            <td className="px-4 py-3 font-medium">{row.refund}</td>
            <td className="px-4 py-3 text-muted-foreground">{row.days}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</section>

{/* Claim section */}
<section className="space-y-3">
  <h2 className="text-xl font-semibold">Если что-то пошло не так</h2>
  <p className="text-sm text-muted-foreground leading-relaxed">
    Если возврат не поступил в установленный срок или вы получили отказ,
    направьте письменную претензию на наш e-mail. Мы обязаны рассмотреть её в течение{" "}
    <strong>10 календарных дней</strong> 
  </p>
</section>

      </main>

      <footer className="border-t py-6 bg-white">
        <div className="container text-center text-sm text-muted-foreground">
          Остались вопросы? Свяжитесь с нами — поможем с отменой брони.
        </div>
      </footer>
    </div>
  );
}
