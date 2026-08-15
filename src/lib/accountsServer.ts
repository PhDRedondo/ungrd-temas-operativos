import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import {
  ADMIN_EMAIL,
  STAFF_DOMAIN,
  isAdminEmail,
  isAllowedAccountEmail,
  normalizeAccountRole,
  normalizeUsername,
  staffEmailFromUsername,
  type AccountRecord,
  type AccountRole,
} from "@/lib/accounts";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "demo-accounts.json");

function seed(): AccountRecord[] {
  const demoPassword = (
    process.env.DEMO_AUTH_PASSWORD || "UNGRD2026"
  ).trim();
  return [
    {
      email: ADMIN_EMAIL,
      name: "Administrador UNGRD",
      password: demoPassword,
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

function normalizeList(accounts: AccountRecord[]): AccountRecord[] {
  return accounts.map((a) => ({
    ...a,
    role: normalizeAccountRole(a.role),
  }));
}

export function readAccountsFile(): AccountRecord[] {
  try {
    if (!existsSync(DATA_FILE)) {
      const initial = seed();
      writeAccountsFile(initial);
      return initial;
    }
    const raw = readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as AccountRecord[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const initial = seed();
      writeAccountsFile(initial);
      return initial;
    }
    let next = normalizeList(parsed);
    if (!next.some((a) => a.email === ADMIN_EMAIL)) {
      next = [...seed().slice(0, 1), ...next];
    }
    writeAccountsFile(next);
    return next;
  } catch {
    const initial = seed();
    try {
      writeAccountsFile(initial);
    } catch {
      /* ignore */
    }
    return initial;
  }
}

export function writeAccountsFile(accounts: AccountRecord[]) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(
    DATA_FILE,
    JSON.stringify(normalizeList(accounts), null, 2),
    "utf8",
  );
}

export function findAccountOnServer(email: string) {
  return readAccountsFile().find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
  );
}

function randomToken() {
  return `inv_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function actorCanCreateAccounts(email: string, role?: string): boolean {
  if (isAdminEmail(email) || role === "admin") return true;
  const account = findAccountOnServer(email);
  return Boolean(account?.active && account.canCreateAccounts);
}

export type CreateInviteOnServerInput = {
  username: string;
  name: string;
  role: AccountRole;
  canCreateAccounts?: boolean;
  createdByEmail: string;
  createdByRole?: string;
};

export type CreateInviteOnServerResult =
  | { ok: true; account: AccountRecord; invitePath: string }
  | { ok: false; error: string };

/** Crea cuenta en el store del servidor y genera token de invitación. */
export function createInviteAccountOnServer(
  input: CreateInviteOnServerInput,
): CreateInviteOnServerResult {
  if (!actorCanCreateAccounts(input.createdByEmail, input.createdByRole)) {
    return { ok: false, error: "No tiene permiso para crear cuentas." };
  }

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

  const accounts = readAccountsFile();
  if (accounts.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
    return { ok: false, error: "Ya existe una cuenta con ese usuario." };
  }

  const creatorIsAdmin =
    isAdminEmail(input.createdByEmail) || input.createdByRole === "admin";
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
    createdBy: input.createdByEmail.toLowerCase(),
  };

  accounts.push(account);
  writeAccountsFile(accounts);

  return {
    ok: true,
    account,
    invitePath: `/cambiar-contrasena?token=${encodeURIComponent(token)}`,
  };
}

export type { AccountRecord, AccountRole };
