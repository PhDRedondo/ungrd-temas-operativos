import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import {
  ADMIN_EMAIL,
  normalizeAccountRole,
  type AccountRecord,
  type AccountRole,
  staffEmailFromUsername,
} from "@/lib/accounts";

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "demo-accounts.json");

function seed(): AccountRecord[] {
  const demoPassword = (
    process.env.DEMO_AUTH_PASSWORD || "admin2026"
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

export type { AccountRecord, AccountRole };
