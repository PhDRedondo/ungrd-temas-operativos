import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Map,
  Shield,
  Sparkles,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

const PILLARS = [
  {
    icon: Shield,
    kicker: "Portafolio",
    title: "19 frentes operativos",
    text: "Agua, puentes, carrotanques, maquinaria, subsidios y más — cada tema con su propia captura y seguimiento.",
  },
  {
    icon: Map,
    kicker: "Territorio",
    title: "Dashboard operativo",
    text: "Filtros por departamento y municipio, mapa nacional e indicadores para la toma de decisión.",
  },
  {
    icon: BarChart3,
    kicker: "Captura",
    title: "Formulario por frente",
    text: "Registro guiado, campo a campo, con el lenguaje de la operación. Cada guardado queda en historial.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-x-hidden bg-ungrd-bg text-ungrd-text">
      {/* Franja Colombia · UNGRD */}
      <div
        className="ungrd-tricolor-bar fixed inset-x-0 top-0 z-[100] h-[3px]"
        aria-hidden
      />

      {/* Header */}
      <header className="relative z-20 border-b border-ungrd-border/80 bg-ungrd-surface/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo
              width={112}
              height={130}
              className="h-12 w-auto object-contain sm:h-14"
              priority
            />
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-extrabold tracking-[0.2em] text-ungrd-navy uppercase dark:text-ungrd-yellow">
                UNGRD
              </p>
              <p className="truncate text-sm font-extrabold text-ungrd-heading">
                Gestión de Temas Operativos
              </p>
              <p className="hidden truncate text-xs text-ungrd-muted sm:block">
                Subdirección de Manejo del Riesgo de Desastres
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle variant="hero" />
            <Link
              href="/login"
              className="rounded-lg border border-ungrd-border bg-ungrd-surface px-3.5 py-2 text-sm font-bold text-ungrd-heading transition hover:border-ungrd-navy/40 hover:bg-ungrd-bg sm:px-4"
            >
              Ingresar
            </Link>
          </div>
        </div>
        <div className="ungrd-tricolor-bar h-1 w-full" aria-hidden />
      </header>

      {/* Hero — plano institucional a sangre */}
      <section className="relative isolate overflow-hidden bg-[#001a36] text-white">
        {/* Foto de territorio / manejo del riesgo (visible a la derecha) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/hero-manejo.png"
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover object-[68%_42%]"
          aria-hidden
        />
        {/* Velo más liviano a la derecha para que la imagen se note */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,rgba(0,22,48,0.92)_0%,rgba(0,32,68,0.78)_42%,rgba(0,26,54,0.38)_72%,rgba(0,26,54,0.22)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#001a36] to-transparent" />
        <div className="pointer-events-none absolute -top-24 right-[-10%] h-[28rem] w-[28rem] rounded-full bg-ungrd-yellow/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-20%] left-[-8%] h-[22rem] w-[22rem] rounded-full bg-[#ce1126]/12 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:gap-14 lg:py-24">
          <div className="animate-fade-up max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase backdrop-blur">
              <Sparkles className="h-3 w-3" />
              Subdirección de Manejo
            </p>
            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-[3.35rem] lg:leading-[1.08]">
              La operación de la UNGRD,
              <span className="mt-1 block text-ungrd-yellow">
                en una sola plataforma
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/72 sm:text-lg">
              Captura, seguimiento y lectura nacional de los frentes de la
              Subdirección de Manejo.
            </p>
            <div className="mt-8">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-ungrd-yellow px-6 py-3.5 text-sm font-extrabold text-ungrd-navy-deep shadow-[0_12px_40px_rgba(255,209,0,0.28)] transition hover:bg-ungrd-yellow-soft hover:shadow-[0_16px_48px_rgba(255,209,0,0.35)]"
              >
                Entrar a la aplicación
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-white/55">
              {[
                "Formulario por frente",
                "Mapa territorial",
                "QuickBI por tema",
              ].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-ungrd-yellow" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <aside className="animate-fade-up-delay relative hidden lg:block">
            <div className="relative overflow-hidden rounded-[1.35rem] border border-white/15 bg-white/[0.06] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="ungrd-tricolor-bar absolute inset-x-0 top-0 h-1" />
              <p className="text-[10px] font-extrabold tracking-[0.2em] text-ungrd-yellow uppercase">
                Enfoque
              </p>
              <p className="mt-2 text-xl font-extrabold text-white">
                Manejo del riesgo en operación real
              </p>
              <p className="mt-3 text-sm leading-relaxed text-white/65">
                Registre cada frente, consulte el territorio y reporte con una
                sola fuente de verdad.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-ungrd-navy-deep/40 px-3.5 py-3">
                  <p className="text-2xl font-extrabold text-ungrd-yellow">19</p>
                  <p className="text-[11px] font-bold text-white/60">
                    Frentes activos
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-ungrd-navy-deep/40 px-3.5 py-3">
                  <p className="text-2xl font-extrabold text-white">1</p>
                  <p className="text-[11px] font-bold text-white/60">
                    Vista nacional
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {/* Pilares */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-16">
        <div className="mb-8 max-w-2xl">
          <p className="text-[10px] font-extrabold tracking-[0.2em] text-ungrd-navy uppercase dark:text-ungrd-yellow">
            Capacidades
          </p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ungrd-heading sm:text-3xl">
            Hecha para operar, no solo para consultar
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ungrd-muted sm:text-base">
            Tres pilares que sostienen el día a día de la Subdirección de Manejo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {PILLARS.map((item, i) => (
            <article
              key={item.title}
              className="group relative overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-5 shadow-[0_12px_40px_rgba(0,45,90,0.06)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:border-ungrd-yellow/55 hover:shadow-[0_22px_55px_rgba(0,45,90,0.16),0_0_0_1px_rgba(255,209,0,0.12)] dark:hover:border-ungrd-yellow/40 dark:hover:shadow-[0_22px_55px_rgba(0,0,0,0.45),0_0_28px_rgba(255,209,0,0.08)] sm:p-6"
              style={{ animationDelay: `${0.08 * i}s` }}
            >
              <div
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,209,0,0.1)_0%,transparent_42%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                aria-hidden
              />
              <div className="ungrd-tricolor-bar absolute inset-x-0 top-0 h-[3px] opacity-80 transition-all duration-300 group-hover:h-1 group-hover:opacity-100" />
              <div className="relative mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--colombia-blue)_10%,var(--ungrd-bg))] text-ungrd-navy transition-all duration-300 group-hover:scale-110 group-hover:bg-[color-mix(in_srgb,var(--colombia-yellow)_22%,var(--ungrd-bg))] group-hover:text-ungrd-navy dark:bg-ungrd-navy/40 dark:text-ungrd-yellow dark:group-hover:bg-ungrd-yellow/15 dark:group-hover:text-ungrd-yellow">
                <item.icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-105" />
              </div>
              <p className="relative text-[10px] font-extrabold tracking-[0.16em] text-ungrd-muted uppercase transition-colors duration-300 group-hover:text-ungrd-navy dark:group-hover:text-ungrd-yellow">
                {item.kicker}
              </p>
              <h3 className="relative mt-1.5 text-lg font-extrabold text-ungrd-heading">
                {item.title}
              </h3>
              <p className="relative mt-2 text-sm leading-relaxed text-ungrd-muted">
                {item.text}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-2xl border border-ungrd-border bg-[linear-gradient(125deg,#002d5a_0%,#0a3d6b_42%,#1a5f8a_78%,color-mix(in_srgb,#ffd100_18%,#0a3d6b)_100%)] p-6 text-white shadow-[0_20px_50px_rgba(0,45,90,0.18)] sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-8">
          <div className="max-w-xl">
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-ungrd-yellow uppercase">
              Subdirección de Manejo
            </p>
            <p className="mt-1 text-xl font-extrabold text-white sm:text-2xl">
              ¿Listo para continuar la operación?
            </p>
          </div>
          <Link
            href="/login"
            className="mt-5 inline-flex shrink-0 items-center gap-2 rounded-xl bg-ungrd-yellow px-5 py-3 text-sm font-extrabold text-ungrd-navy-deep transition hover:bg-ungrd-yellow-soft sm:mt-0"
          >
            Ir al ingreso
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-ungrd-border bg-ungrd-surface px-5 py-6 text-center sm:px-8">
        <p className="text-xs font-semibold text-ungrd-muted">
          UNGRD · Gestión de Temas Operativos · Subdirección de Manejo del Riesgo
          de Desastres
        </p>
        <div
          className="ungrd-tricolor-bar mx-auto mt-4 h-1 w-24 rounded-full"
          aria-hidden
        />
      </footer>
    </main>
  );
}
