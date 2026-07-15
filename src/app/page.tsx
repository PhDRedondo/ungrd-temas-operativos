import Link from "next/link";
import { ArrowRight, BarChart3, Map, Shield } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ungrd-hero text-ungrd-hero-fg transition-colors">
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-70" />
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-ungrd-yellow/25 blur-3xl dark:bg-ungrd-yellow/20" />
      <div className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-ungrd-navy/15 blur-3xl dark:bg-ungrd-navy-mid/80" />

      <header className="relative z-10 border-b border-ungrd-card-border bg-ungrd-surface/90 shadow-[0_8px_24px_rgba(0,45,90,0.08)] backdrop-blur-md dark:bg-ungrd-navy-deep/85 dark:shadow-[0_8px_28px_rgba(0,0,0,0.35)]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandLogo
              width={120}
              height={140}
              className="h-14 w-auto object-contain"
              priority
            />
            <div className="leading-tight">
              <p className="text-xs font-bold tracking-[0.16em] text-ungrd-navy uppercase dark:text-ungrd-yellow">
                UNGRD
              </p>
              <p className="text-sm text-ungrd-hero-muted">
                Gestión de Temas Operativos
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle variant="hero" />
            <Link
              href="/login"
              className="rounded-lg border border-ungrd-card-border bg-ungrd-surface px-4 py-2 text-sm font-semibold text-ungrd-hero-fg transition hover:border-ungrd-yellow hover:text-ungrd-heading dark:bg-white/5 dark:hover:text-ungrd-yellow"
            >
              Ingresar
            </Link>
          </div>
        </div>
        <div
          className="h-1 w-full bg-[linear-gradient(90deg,#ffd100_0%,#002d5a_52%,#ce1126_100%)]"
          aria-hidden
        />
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pt-16">
        <div className="animate-fade-up">
          <p className="mb-4 text-sm font-bold tracking-[0.2em] text-ungrd-heading uppercase dark:text-ungrd-yellow">
            Unidad Nacional para la Gestión del Riesgo de Desastres
          </p>
          <h1 className="max-w-xl text-4xl leading-[1.05] font-extrabold tracking-tight text-ungrd-heading sm:text-5xl lg:text-6xl dark:text-white">
            Una vista operativa para capturar, validar y analizar la respuesta
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-ungrd-hero-muted sm:text-lg">
            Plataforma institucional para los temas misionales de la UNGRD:
            captura individual o masiva, y analítica territorial con mapas,
            indicadores y series de tiempo.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-ungrd-yellow px-5 py-3 text-sm font-extrabold text-ungrd-navy-deep transition hover:bg-ungrd-yellow-soft"
            >
              Entrar a la aplicación
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login?next=/app/acerca"
              className="rounded-lg px-4 py-3 text-sm font-semibold text-ungrd-hero-muted underline-offset-4 hover:text-ungrd-heading hover:underline dark:hover:text-white"
            >
              Conocer el sistema
            </Link>
          </div>
        </div>

        <div className="animate-fade-up-delay grid gap-4">
          {[
            {
              icon: Shield,
              title: "19 temas operativos",
              text: "Desde agua y saneamiento hasta presupuesto y declaratorias.",
            },
            {
              icon: Map,
              title: "Analítica territorial",
              text: "Filtros, mapa departamental/municipal, tortas, barras, Sankey y calor.",
            },
            {
              icon: BarChart3,
              title: "Captura flexible",
              text: "Formulario individual o carga masiva mediante plantillas Excel.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-ungrd-card-border bg-ungrd-card-glass p-5 backdrop-blur-sm transition hover:border-ungrd-yellow/50"
            >
              <item.icon className="mb-3 h-6 w-6 text-ungrd-heading dark:text-ungrd-yellow" />
              <h2 className="text-lg font-bold text-ungrd-heading dark:text-white">
                {item.title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ungrd-hero-muted">
                {item.text}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-ungrd-card-border px-6 py-5 text-center text-xs text-ungrd-muted">
        SNGRD · UNGRD — Prototipo de gestión temática · Demo local
      </footer>
    </main>
  );
}
