"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  KeyRound,
  Mail,
  Shield,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { canAdmin } from "@/lib/auth/roles";
import {
  ADMIN_EMAIL,
  ROLE_LABELS,
  STAFF_DOMAIN,
  type AccountRecord,
  type AccountRole,
  canAccessAccountsPage,
  createAccount,
  isPlatformAdmin,
  loadAccounts,
  updateAccountFlags,
} from "@/lib/accounts";

export default function CuentasPermisosPage() {
  const { user, ready, role } = useAuth();
  const router = useRouter();
  const isAdmin = canAdmin(role || undefined) || isPlatformAdmin(user?.email || "");
  const canManage = Boolean(
    user?.email && canAccessAccountsPage(user.email),
  );
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [roleForm, setRoleForm] = useState<AccountRole>("analista");
  const [grantCreate, setGrantCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  function reload() {
    setAccounts(loadAccounts());
  }

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/login?next=/app/cuentas");
      return;
    }
    if (!canManage && !isAdmin) {
      router.replace("/app");
      return;
    }
    reload();
  }, [ready, user, canManage, isAdmin, router]);

  const sorted = useMemo(
    () =>
      [...accounts].sort((a, b) => {
        if (a.email === ADMIN_EMAIL) return -1;
        if (b.email === ADMIN_EMAIL) return 1;
        return a.email.localeCompare(b.email);
      }),
    [accounts],
  );

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setInviteUrl(null);
    setCopied(false);

    const result = createAccount({
      username,
      name,
      role: roleForm,
      canCreateAccounts: isAdmin ? grantCreate : false,
      createdBy: user.email,
    });

    if (!result.ok) {
      setError(result.error);
      return;
    }

    const absolute =
      typeof window !== "undefined"
        ? `${window.location.origin}${result.inviteUrl}`
        : result.inviteUrl;

    setInviteUrl(absolute);
    setFlash(
      `Cuenta creada. Se simuló el envío de correo a ${result.account.email}.`,
    );
    setUsername("");
    setName("");
    setRoleForm("analista");
    setGrantCreate(false);
    reload();
  }

  function toggleCreatePermission(account: AccountRecord, value: boolean) {
    if (!user || !isAdmin) return;
    const res = updateAccountFlags(
      account.email,
      { canCreateAccounts: value },
      user.email,
    );
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setFlash(
      value
        ? `${account.email} ahora puede crear cuentas.`
        : `Se retiró el permiso de crear cuentas a ${account.email}.`,
    );
    reload();
  }

  function toggleActive(account: AccountRecord, value: boolean) {
    if (!user || !isAdmin) return;
    const res = updateAccountFlags(account.email, { active: value }, user.email);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    reload();
  }

  function changeRole(account: AccountRecord, nextRole: AccountRole) {
    if (!user || !isAdmin) return;
    const res = updateAccountFlags(account.email, { role: nextRole }, user.email);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    reload();
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!ready || !user || (!canManage && !isAdmin)) {
    return (
      <div className="py-16 text-center text-sm text-ungrd-muted">
        Verificando permisos…
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-5">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-ungrd-navy uppercase">
          Administración
        </p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-extrabold text-ungrd-heading">
          <Shield className="h-6 w-6 text-ungrd-navy" />
          Cuentas y permisos
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-ungrd-muted">
          Solo el administrador ({ADMIN_EMAIL}) gestiona este módulo y decide quién
          puede crear cuentas. Las cuentas institucionales usan el dominio{" "}
          <strong className="text-ungrd-heading">@{STAFF_DOMAIN}</strong>: al
          crear, indique únicamente el usuario (sin el correo completo). Se
          simula un correo de invitación para cambiar la contraseña. Los
          permisos por tema siguen en{" "}
          <a
            href="/app/admin/permisos"
            className="font-bold text-ungrd-navy underline-offset-2 hover:underline"
          >
            Permisos por tema
          </a>
          .
        </p>
      </div>

      {flash && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {flash}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-ungrd-danger dark:border-red-900/40 dark:bg-red-950/30">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-ungrd-heading">
          <UserPlus className="h-4 w-4 text-ungrd-navy" />
          Crear cuenta
        </h2>
        <p className="mt-1 text-xs text-ungrd-muted">
          El usuario recibirá un enlace (demo) para definir su contraseña antes de
          usar la plataforma.
        </p>

        <form
          onSubmit={onCreate}
          className="mt-4 grid gap-3 sm:grid-cols-2"
        >
          <label className="text-sm font-semibold text-ungrd-heading sm:col-span-1">
            Usuario
            <div className="mt-1.5 flex min-w-0 overflow-hidden rounded-lg border border-ungrd-border bg-ungrd-input focus-within:ring-2 focus-within:ring-ungrd-yellow/40">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nombre.apellido"
                className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm text-ungrd-text outline-none"
                required
                autoComplete="off"
              />
              <span className="shrink-0 border-l border-ungrd-border bg-ungrd-bg px-2 py-2.5 text-xs font-bold text-ungrd-muted">
                @{STAFF_DOMAIN}
              </span>
            </div>
          </label>

          <label className="text-sm font-semibold text-ungrd-heading">
            Nombre completo
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm text-ungrd-text outline-none focus:ring-2 focus:ring-ungrd-yellow/40"
              placeholder="Nombre para mostrar"
              required
            />
          </label>

          <label className="text-sm font-semibold text-ungrd-heading">
            Rol
            <select
              value={roleForm}
              onChange={(e) => setRoleForm(e.target.value as AccountRole)}
              className="mt-1.5 w-full rounded-lg border border-ungrd-border bg-ungrd-input px-3 py-2.5 text-sm font-semibold text-ungrd-text"
            >
              {(["analista", "captura", "auditor"] as AccountRole[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          {isAdmin && (
            <label className="flex items-end gap-2 pb-2 text-sm font-semibold text-ungrd-heading">
              <input
                type="checkbox"
                checked={grantCreate}
                onChange={(e) => setGrantCreate(e.target.checked)}
                className="mt-1 h-4 w-4 accent-ungrd-navy"
              />
              <span>
                Permitir crear cuentas
                <span className="block text-xs font-normal text-ungrd-muted">
                  Solo el administrador puede otorgar este permiso.
                </span>
              </span>
            </label>
          )}

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-ungrd-navy px-4 py-2.5 text-sm font-extrabold text-white hover:bg-ungrd-navy-mid"
            >
              <Mail className="h-4 w-4 text-ungrd-yellow" />
              Crear y enviar invitación
            </button>
          </div>
        </form>

        {inviteUrl && (
          <div className="mt-4 rounded-xl border border-ungrd-yellow/50 bg-[color-mix(in_srgb,#ffd100_18%,transparent)] p-4">
            <p className="flex items-center gap-2 text-sm font-extrabold text-ungrd-heading">
              <KeyRound className="h-4 w-4" />
              Correo de invitación (simulado)
            </p>
            <p className="mt-1 text-xs text-ungrd-muted">
              En producción este enlace iría al buzón institucional. En la demo,
              cópielo y ábralo para completar el cambio de contraseña.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="block min-w-0 flex-1 truncate rounded-lg border border-ungrd-border bg-ungrd-surface px-3 py-2 text-xs text-ungrd-heading">
                {inviteUrl}
              </code>
              <button
                type="button"
                onClick={copyInvite}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-ungrd-border bg-ungrd-surface px-3 py-2 text-xs font-bold text-ungrd-heading"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copiado" : "Copiar enlace"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-ungrd-border bg-ungrd-surface p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-ungrd-heading">
          <Users className="h-4 w-4 text-ungrd-navy" />
          Directorio de cuentas
        </h2>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-xs tracking-wide text-ungrd-muted uppercase">
              <tr>
                <th className="px-2 py-2">Cuenta</th>
                <th className="px-2 py-2">Rol</th>
                <th className="px-2 py-2">Crear cuentas</th>
                <th className="px-2 py-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((account) => {
                const isSeedAdmin = account.email === ADMIN_EMAIL;
                return (
                  <tr
                    key={account.email}
                    className="border-t border-ungrd-border"
                  >
                    <td className="px-2 py-3">
                      <p className="font-semibold text-ungrd-heading">
                        {account.name}
                      </p>
                      <p className="font-mono text-xs text-ungrd-muted">
                        {account.email}
                      </p>
                      {account.mustChangePassword && (
                        <p className="mt-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                          Pendiente cambiar contraseña
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {isAdmin && !isSeedAdmin ? (
                        <select
                          value={account.role}
                          onChange={(e) =>
                            changeRole(
                              account,
                              e.target.value as AccountRole,
                            )
                          }
                          className="rounded-lg border border-ungrd-border bg-ungrd-input px-2 py-1.5 text-xs font-semibold"
                        >
                          {(["analista", "captura", "auditor"] as AccountRole[]).map(
                            (r) => (
                              <option key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </option>
                            ),
                          )}
                        </select>
                      ) : (
                        <span className="text-xs font-bold text-ungrd-heading">
                          {ROLE_LABELS[account.role]}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {isSeedAdmin ? (
                        <span className="text-xs font-bold text-ungrd-muted">
                          Sí (admin)
                        </span>
                      ) : isAdmin ? (
                        <label className="inline-flex items-center gap-2 text-xs font-semibold">
                          <input
                            type="checkbox"
                            checked={account.canCreateAccounts}
                            onChange={(e) =>
                              toggleCreatePermission(account, e.target.checked)
                            }
                            className="accent-ungrd-navy"
                          />
                          {account.canCreateAccounts ? "Permitido" : "No"}
                        </label>
                      ) : (
                        <span className="text-xs text-ungrd-muted">
                          {account.canCreateAccounts ? "Permitido" : "No"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      {isSeedAdmin ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                          Activa
                        </span>
                      ) : isAdmin ? (
                        <button
                          type="button"
                          onClick={() => toggleActive(account, !account.active)}
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            account.active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                              : "bg-ungrd-bg text-ungrd-muted"
                          }`}
                        >
                          {account.active ? "Activa" : "Inactiva"}
                        </button>
                      ) : (
                        <span className="text-xs text-ungrd-muted">
                          {account.active ? "Activa" : "Inactiva"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isAdmin && (
          <p className="mt-3 text-xs text-ungrd-muted">
            Tiene permiso delegado para crear cuentas. La asignación de quién
            puede crear cuentas la define únicamente {ADMIN_EMAIL}.
          </p>
        )}
      </section>
    </div>
  );
}
