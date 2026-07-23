"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";

function LoginForm() {
  const { login, loginWithKeycloak, user, ready, authMode } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/app";
  const [email, setEmail] = useState("");
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
    const result = await login(email, password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error || "No fue posible iniciar sesión.");
      return;
    }
    router.push(next);
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ungrd-bg px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,209,0,0.18),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(0,45,90,0.18),transparent_40%)]" />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md animate-fade-up overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface shadow-[0_24px_60px_rgba(0,45,90,0.12)]">
        <div className="bg-ungrd-navy-deep px-6 py-8 text-center text-white">
          <BrandLogo
            width={160}
            height={190}
            className="mx-auto h-28 w-auto object-contain"
            priority
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            Acceso UNGRD
          </h1>
          <p className="mt-1 text-sm text-white/70">
            Gestión de Temas Operativos
          </p>
          <p className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-ungrd-yellow uppercase">
            Auth: {authMode === "keycloak" ? "Keycloak OIDC" : "Demo local"}
          </p>
        </div>

        {authMode === "keycloak" ? (
          <div className="space-y-4 px-6 py-6">
            <p className="text-sm text-ungrd-muted">
              Autenticación institucional vía{" "}
              <strong className="text-ungrd-heading">Keycloak</strong> (open
              source). Roles: captura, analista, admin, auditor.
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
              Correo institucional
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo autorizado"
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
                placeholder="Contraseña"
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

            <p className="text-center text-xs text-ungrd-muted">
              Acceso restringido. Use las credenciales institucionales asignadas.
            </p>
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
        <div className="flex min-h-screen items-center justify-center bg-ungrd-bg text-ungrd-muted">
          Cargando…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
