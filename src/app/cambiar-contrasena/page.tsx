"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  findAccount,
  findAccountByToken,
  loadAccounts,
  saveAccounts,
} from "@/lib/accounts";
import { useAuth } from "@/lib/auth";

function syncLocalPassword(email: string, password: string) {
  const accounts = loadAccounts();
  const idx = accounts.findIndex(
    (a) => a.email.toLowerCase() === email.toLowerCase(),
  );
  if (idx < 0) return;
  accounts[idx] = {
    ...accounts[idx]!,
    password,
    mustChangePassword: false,
    inviteToken: null,
  };
  saveAccounts(accounts, { sync: false });
}

function ChangePasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const sessionMode = params.get("session") === "1";
  const router = useRouter();
  const { login, user, ready, logout } = useAuth();

  const invited = useMemo(
    () => (token ? findAccountByToken(token) : undefined),
    [token],
  );

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailLabel = invited?.email || user?.email || "";
  const needsPasswordChange = Boolean(
    user?.email && findAccount(user.email)?.mustChangePassword,
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);

    if (token) {
      try {
        const res = await fetch("/api/accounts/complete-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, password }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          email?: string;
          error?: string;
        };
        if (!res.ok || !data.email) {
          setLoading(false);
          setError(data.error || "No se pudo actualizar la contraseña.");
          return;
        }
        syncLocalPassword(data.email, password);
        const session = await login(data.email, password);
        if (!session.ok) {
          setLoading(false);
          setError(session.error || "Contraseña actualizada. Inicie sesión.");
          router.push("/login");
          return;
        }
        window.location.assign(session.redirectTo || "/app");
        return;
      } catch {
        setLoading(false);
        setError("Error de red al actualizar la contraseña.");
        return;
      }
    }

    if (sessionMode && user) {
      try {
        const res = await fetch("/api/accounts/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword,
            newPassword: password,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok) {
          setLoading(false);
          setError(data.error || "No se pudo cambiar la contraseña.");
          return;
        }
        syncLocalPassword(user.email, password);
        setLoading(false);
        window.location.assign("/app");
        return;
      } catch {
        setLoading(false);
        setError("Error de red al cambiar la contraseña.");
        return;
      }
    }

    setLoading(false);
    setError("Enlace o sesión no válidos.");
  }

  const showInviteForm = Boolean(token);
  const showSessionForm =
    sessionMode && ready && Boolean(user) && needsPasswordChange;
  const showForm = showInviteForm || showSessionForm;
  const showBlocked =
    !showForm &&
    ready &&
    (sessionMode || (!token && !sessionMode));

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ungrd-bg px-4 py-10">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface shadow-[0_24px_60px_rgba(0,45,90,0.12)]">
        <div className="bg-ungrd-navy-deep px-6 py-8 text-center text-white">
          <BrandLogo
            width={140}
            height={170}
            className="mx-auto h-24 w-auto object-contain"
            priority
          />
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight">
            Definir contraseña
          </h1>
          <p className="mt-1 text-sm text-white/70">
            Invitación a la plataforma de Temas Operativos
          </p>
        </div>

        {showBlocked ? (
          <div className="space-y-4 px-6 py-6 text-sm">
            <p className="text-ungrd-muted">
              {sessionMode && !user
                ? "Debe iniciar sesión para cambiar la contraseña."
                : "El enlace de invitación no es válido o ya fue utilizado. Solicite una nueva invitación al administrador."}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/login"
                className="inline-flex font-bold text-ungrd-heading hover:underline"
              >
                Ir al inicio de sesión
              </Link>
              {user && (
                <button
                  type="button"
                  onClick={() => {
                    void logout();
                  }}
                  className="font-bold text-ungrd-muted hover:underline"
                >
                  Cerrar sesión
                </button>
              )}
            </div>
          </div>
        ) : !showForm ? (
          <div className="px-6 py-10 text-center text-sm text-ungrd-muted">
            Cargando…
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 px-6 py-6">
            <p className="rounded-lg bg-ungrd-bg px-3 py-2 text-sm text-ungrd-text">
              Cuenta:{" "}
              <strong className="text-ungrd-heading">
                {emailLabel || (token ? "Invitación pendiente" : "")}
              </strong>
            </p>
            {sessionMode && (
              <label className="block text-sm font-semibold text-ungrd-heading">
                Contraseña temporal actual
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ungrd-yellow/40"
                  required
                  autoComplete="current-password"
                />
              </label>
            )}
            <label className="block text-sm font-semibold text-ungrd-heading">
              Nueva contraseña
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ungrd-yellow/40"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            <label className="block text-sm font-semibold text-ungrd-heading">
              Confirmar contraseña
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ungrd-yellow/40"
                minLength={8}
                required
                autoComplete="new-password"
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
              className="w-full rounded-lg bg-ungrd-navy px-4 py-2.5 text-sm font-extrabold text-white hover:bg-ungrd-navy-mid disabled:opacity-60"
            >
              {loading ? "Guardando…" : "Guardar e ingresar"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function CambiarContrasenaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ungrd-bg text-ungrd-muted">
          Cargando…
        </div>
      }
    >
      <ChangePasswordForm />
    </Suspense>
  );
}
