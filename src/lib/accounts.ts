/**
 * Directorio demo de cuentas.
 * Cliente: localStorage. Servidor (authorize/API): memoria global del proceso.
 */

export const STAFF_DOMAIN = "gestiondelriesgo.gov.co";
export const ADMIN_EMAIL = "admin@ungrd.gov.co";
export const ACCOUNTS_KEY = "ungrd-demo-accounts";

export type AccountRole =
  | "admin"
  | "subdirector"
  | "coordinador"
  | "operativo";

/** Migra roles legacy (analista/captura/auditor) al modelo institucional. */
export function normalizeAccountRole(role: string | undefined): AccountRole {
  if (role === "admin") return "admin";
  if (role === "subdirector" || role === "auditor") return "subdirector";
  if (role === "coordinador" || role === "analista") return "coordinador";
  if (role === "operativo" || role === "captura") return "operativo";
  return "operativo";
}

export const ASSIGNABLE_ACCOUNT_ROLES: Exclude<AccountRole, "admin">[] = [
  "subdirector",
  "coordinador",
  "operativo",
];

export type AccountRecord = {
  email: string;
  name: string;
  /** Demo only — never store plaintext passwords in production. */
  password: string;
  role: AccountRole;
  /** Solo el admin puede otorgar este permiso. */
  canCreateAccounts: boolean;
  mustChangePassword: boolean;
  inviteToken: string | null;
  active: boolean;
  createdAt: string;
  createdBy: string | null;
};

type GlobalAccounts = typeof globalThis & {
  __ungrdDemoAccounts?: AccountRecord[];
};

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/@.*$/, "");
}

export function staffEmailFromUsername(username: string): string {
  return `${normalizeUsername(username)}@${STAFF_DOMAIN}`;
}

export function resolveLoginEmail(input: string): string {
  const raw = input.trim().toLowerCase();
  if (!raw) return "";
  if (raw.includes("@")) return raw;
  if (raw === "admin") return ADMIN_EMAIL;
  return staffEmailFromUsername(raw);
}

export function isAdminEmail(email: string): boolean {
  return email.trim().toLowerCase() === ADMIN_EMAIL;
}

export function isAllowedAccountEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (e === ADMIN_EMAIL) return true;
  return e.endsWith(`@${STAFF_DOMAIN}`);
}

function seedAccounts(): AccountRecord[] {
  return [
    {
      email: ADMIN_EMAIL,
      name: "Administrador UNGRD",
      password: "admin2026",
      role: "admin",
      canCreateAccounts: true,
      mustChangePassword: false,
      inviteToken: null,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: null,
    },
    {
      email: staffEmailFromUsername("operativo"),
      name: "Operativo demo",
      password: "ungrd2026",
      role: "operativo",
      canCreateAccounts: false,
      mustChangePassword: false,
      inviteToken: null,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: ADMIN_EMAIL,
    },
  ];
}

function readClientStore(): AccountRecord[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccountRecord[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeClientStore(accounts: AccountRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {
    /* ignore */
  }
}

function ensureAdmin(accounts: AccountRecord[]): AccountRecord[] {
  if (accounts.some((a) => a.email === ADMIN_EMAIL)) return accounts;
  return [...seedAccounts().slice(0, 1), ...accounts];
}

export function loadAccounts(): AccountRecord[] {
  const g = globalThis as GlobalAccounts;
  const client = readClientStore();
  if (client && client.length) {
    const withAdmin = ensureAdmin(client).map((a) => ({
      ...a,
      role: normalizeAccountRole(a.role),
    }));
    g.__ungrdDemoAccounts = withAdmin;
    return withAdmin;
  }
  if (!g.__ungrdDemoAccounts || g.__ungrdDemoAccounts.length === 0) {
    g.__ungrdDemoAccounts = seedAccounts();
  }
  writeClientStore(g.__ungrdDemoAccounts);
  return g.__ungrdDemoAccounts;
}

export function saveAccounts(accounts: AccountRecord[]) {
  const g = globalThis as GlobalAccounts;
  g.__ungrdDemoAccounts = accounts;
  writeClientStore(accounts);
  if (typeof window !== "undefined") {
    void fetch("/api/accounts/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accounts }),
    }).catch(() => {
      /* ignore sync errors in demo */
    });
  }
}

export function findAccount(email: string): AccountRecord | undefined {
  return loadAccounts().find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  );
}

export function findAccountByToken(token: string): AccountRecord | undefined {
  return loadAccounts().find((a) => a.inviteToken === token);
}

function randomToken() {
  return `inv_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export type CreateAccountInput = {
  username: string;
  name: string;
  role: AccountRole;
  canCreateAccounts?: boolean;
  createdBy: string;
};

export type CreateAccountResult =
  | {
      ok: true;
      account: AccountRecord;
      inviteUrl: string;
    }
  | { ok: false; error: string };

export function createAccount(input: CreateAccountInput): CreateAccountResult {
  const username = normalizeUsername(input.username);
  if (!username || !/^[a-z0-9._-]+$/i.test(username)) {
    return {
      ok: false,
      error: "Usuario inválido. Use solo letras, números, punto, guion o _.",
    };
  }
  if (username === "admin") {
    return { ok: false, error: "El usuario admin está reservado." };
  }

  const email = staffEmailFromUsername(username);
  if (!isAllowedAccountEmail(email)) {
    return {
      ok: false,
      error: `Solo se permiten cuentas @${STAFF_DOMAIN}.`,
    };
  }

  const accounts = loadAccounts();
  if (accounts.some((a) => a.email === email)) {
    return { ok: false, error: "Ya existe una cuenta con ese usuario." };
  }

  const creator = findAccount(input.createdBy);
  if (!creator?.active) {
    return { ok: false, error: "No tiene permiso para crear cuentas." };
  }
  const creatorIsAdmin = isAdminEmail(creator.email) || creator.role === "admin";
  if (!creatorIsAdmin && !creator.canCreateAccounts) {
    return { ok: false, error: "No tiene permiso para crear cuentas." };
  }

  const canCreate =
    creatorIsAdmin && Boolean(input.canCreateAccounts) ? true : false;

  const token = randomToken();
  const tempPassword = `Tmp${Math.random().toString(36).slice(2, 8)}!`;

  const account: AccountRecord = {
    email,
    name: input.name.trim() || username,
    password: tempPassword,
    role: input.role === "admin" ? "operativo" : normalizeAccountRole(input.role),
    canCreateAccounts: canCreate,
    mustChangePassword: true,
    inviteToken: token,
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: creator.email,
  };

  accounts.push(account);
  saveAccounts(accounts);

  const inviteUrl = `/cambiar-contrasena?token=${encodeURIComponent(token)}`;
  return { ok: true, account, inviteUrl };
}

export function updateAccountFlags(
  email: string,
  patch: Partial<
    Pick<AccountRecord, "role" | "canCreateAccounts" | "active" | "name">
  >,
  actorEmail: string,
): { ok: true } | { ok: false; error: string } {
  const actor = findAccount(actorEmail);
  if (!actor || (!isAdminEmail(actor.email) && actor.role !== "admin")) {
    return { ok: false, error: "Solo el administrador puede editar permisos." };
  }

  const accounts = loadAccounts();
  const idx = accounts.findIndex(
    (a) => a.email.toLowerCase() === email.toLowerCase(),
  );
  if (idx < 0) return { ok: false, error: "Cuenta no encontrada." };

  const current = accounts[idx]!;
  if (current.email === ADMIN_EMAIL) {
    if (
      patch.role !== undefined ||
      patch.canCreateAccounts !== undefined ||
      patch.active !== undefined
    ) {
      return {
        ok: false,
        error: "La cuenta administrador no se puede modificar.",
      };
    }
  }

  accounts[idx] = {
    ...current,
    ...patch,
    role:
      patch.role === "admin"
        ? current.role
        : patch.role !== undefined
          ? normalizeAccountRole(patch.role)
          : current.role,
  };
  saveAccounts(accounts);
  return { ok: true };
}

export function completePasswordChange(
  token: string,
  newPassword: string,
): { ok: true; email: string } | { ok: false; error: string } {
  if (newPassword.length < 8) {
    return {
      ok: false,
      error: "La nueva contraseña debe tener al menos 8 caracteres.",
    };
  }
  const accounts = loadAccounts();
  const idx = accounts.findIndex((a) => a.inviteToken === token);
  if (idx < 0) {
    return { ok: false, error: "Enlace de invitación inválido o vencido." };
  }
  const current = accounts[idx]!;
  accounts[idx] = {
    ...current,
    password: newPassword,
    mustChangePassword: false,
    inviteToken: null,
  };
  saveAccounts(accounts);
  return { ok: true, email: current.email };
}

export function changePasswordWithSession(
  email: string,
  currentPassword: string,
  newPassword: string,
): { ok: true } | { ok: false; error: string } {
  if (newPassword.length < 8) {
    return {
      ok: false,
      error: "La nueva contraseña debe tener al menos 8 caracteres.",
    };
  }
  const accounts = loadAccounts();
  const idx = accounts.findIndex(
    (a) => a.email.toLowerCase() === email.toLowerCase(),
  );
  if (idx < 0) return { ok: false, error: "Cuenta no encontrada." };
  const current = accounts[idx]!;
  if (current.password !== currentPassword) {
    return { ok: false, error: "La contraseña actual no es correcta." };
  }
  accounts[idx] = {
    ...current,
    password: newPassword,
    mustChangePassword: false,
    inviteToken: null,
  };
  saveAccounts(accounts);
  return { ok: true };
}

export function canAccessAccountsPage(email: string): boolean {
  const account = findAccount(email);
  if (!account?.active) return false;
  if (isAdminEmail(account.email) || account.role === "admin") return true;
  return account.canCreateAccounts;
}

export function isPlatformAdmin(email: string): boolean {
  const account = findAccount(email);
  if (!account?.active) return false;
  return isAdminEmail(account.email) || account.role === "admin";
}

export function canCreateAccountsPermission(email: string): boolean {
  const account = findAccount(email);
  if (!account?.active) return false;
  if (isAdminEmail(account.email) || account.role === "admin") return true;
  return account.canCreateAccounts;
}

export const ROLE_LABELS: Record<AccountRole, string> = {
  admin: "Administrador",
  subdirector: "Subdirector",
  coordinador: "Coordinador",
  operativo: "Operativo",
};
