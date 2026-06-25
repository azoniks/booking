import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Отмена брони",
  description: "Как отменить бронирование",
};

export default function CancelBookingPage() {
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
            Отмена брони
          </h1>
        </div>

        {/* TODO: контент страницы — заполняется вручную */}
      </main>

      <footer className="border-t py-6 bg-white">
        <div className="container text-center text-sm text-muted-foreground">
          Остались вопросы? Свяжитесь с нами — поможем с бронированием.
        </div>
      </footer>
    </div>
  );
}
