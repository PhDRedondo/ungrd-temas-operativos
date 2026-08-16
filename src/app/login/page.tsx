"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { resolveLoginEmail } from "@/lib/accounts";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./login.css";

function redirectPath(url: string | undefined | null, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin === window.location.origin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback;
    }
  } catch {
    /* ignore */
  }
  return fallback;
}

function LoginForm() {
  const { login, loginWithKeycloak, user, ready, authMode } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, router, next]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const email = resolveLoginEmail(username);
    const result = await login(email, password, next);
    if (!result.ok) {
      setLoading(false);
      setError(result.error || "No fue posible iniciar sesión.");
      return;
    }
    const target = redirectPath(result.redirectTo, next);
    window.location.assign(target.startsWith("/") ? target : next);
  }

  return (
    <main className="login-space relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="login-bg-photo" aria-hidden />
      <div className="login-bg-veil" aria-hidden />
      <div className="login-bg-grid" aria-hidden />

      <div className="login-brand-mark" aria-hidden>
        <p className="kicker">UNGRD</p>
        <p className="title">
          Subdirección de Manejo
          <span className="mt-1 block text-ungrd-yellow">
            del Riesgo de Desastres
          </span>
        </p>
        <p className="sub">
          Plataforma de temas operativos para el seguimiento territorial.
        </p>
      </div>

      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle variant="hero" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-up overflow-hidden rounded-2xl border border-white/15 bg-ungrd-surface shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
        <div className="ungrd-tricolor-bar h-1 w-full" aria-hidden />
        <div className="login-card-head px-6 py-8 text-center text-white">
          <BrandLogo
            width={160}
            height={190}
            className="mx-auto h-24 w-auto object-contain sm:h-28"
            priority
          />
          <p className="mt-4 inline-flex items-center rounded-full border border-ungrd-yellow/40 bg-black/20 px-3 py-1 text-[10px] font-extrabold tracking-[0.16em] text-ungrd-yellow uppercase">
            Subdirección de Manejo
          </p>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
            Acceso operativo
          </h1>
          <p className="mt-1.5 text-sm text-white/75">
            Gestión de Temas Operativos · UNGRD
          </p>
        </div>

        {authMode === "keycloak" ? (
          <div className="space-y-4 px-6 py-6">
            <p className="text-sm text-ungrd-muted">
              Autenticación institucional vía Keycloak.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                await loginWithKeycloak();
              }}
              className="w-full rounded-lg bg-ungrd-navy px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-ungrd-navy-mid disabled:opacity-60"
            >
              {loading ? "Redirigiendo…" : "Continuar con Keycloak"}
            </button>
            <p className="text-center text-sm">
              <Link
                href="/"
                className="font-semibold text-ungrd-heading hover:underline"
              >
                Volver al inicio
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 px-6 py-6">
            <label className="block text-sm font-semibold text-ungrd-heading">
              Usuario institucional
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm text-ungrd-text outline-none transition focus:border-ungrd-navy focus:ring-2 focus:ring-ungrd-yellow/40"
                autoComplete="username"
                required
              />
            </label>
            <label className="block text-sm font-semibold text-ungrd-heading">
              Contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm text-ungrd-text outline-none transition focus:border-ungrd-navy focus:ring-2 focus:ring-ungrd-yellow/40"
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-ungrd-danger dark:bg-red-950/40">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-ungrd-navy px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-ungrd-navy-mid disabled:opacity-60"
            >
              {loading ? "Validando…" : "Ingresar"}
            </button>

            <p className="text-center text-sm">
              <Link
                href="/"
                className="font-semibold text-ungrd-heading hover:underline"
              >
                Volver al inicio
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="login-space flex min-h-screen items-center justify-center text-white/70">
          Cargando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
