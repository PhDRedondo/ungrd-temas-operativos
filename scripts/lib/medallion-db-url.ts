/**
 * Helpers de conexión medallón (reader / admin pooler).
 * Nunca imprime passwords.
 */
import { config } from "dotenv";
import path from "path";

const PROJECT_REF = "vbxvqctdemtnmkifrxeo";
const POOLER_HOST = "aws-1-us-west-2.pooler.supabase.com";

export function loadMedallionEnv(): void {
  config({ path: path.resolve(process.cwd(), ".env.local") });
  config({ path: path.resolve(process.cwd(), ".env") });
}

export function maskDbUrl(url: string): string {
  try {
    const u = new URL(url.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"));
    return `postgresql://${u.username}:***@${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(url inválida)";
  }
}

/** Deriva URL admin Session pooler :5432 desde MEDALLION_DATABASE_URL (mismo password). */
export function adminUrlFromMedallion(
  medallionUrl: string,
  opts?: { projectRef?: string; host?: string },
): string {
  const u = new URL(
    medallionUrl.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"),
  );
  const password = u.password;
  if (!password) throw new Error("MEDALLION_DATABASE_URL sin password");
  const ref = opts?.projectRef || PROJECT_REF;
  const host = opts?.host || u.hostname || POOLER_HOST;
  const encPass = encodeURIComponent(decodeURIComponent(password)).replace(
    /\*/g,
    "%2A",
  );
  return `postgresql://postgres.${ref}:${encPass}@${host}:5432/postgres?sslmode=require`;
}

export function resolveAdminDatabaseUrl(): {
  adminUrl: string;
  source: "DATABASE_URL" | "MEDALLION_DERIVED";
} {
  const db = process.env.DATABASE_URL || "";
  if (db && !/127\.0\.0\.1|localhost/i.test(db) && /supabase|pooler/i.test(db)) {
    return { adminUrl: db, source: "DATABASE_URL" };
  }
  const med = process.env.MEDALLION_DATABASE_URL || "";
  if (!med) {
    throw new Error(
      "Falta MEDALLION_DATABASE_URL (o DATABASE_URL de prod pooler) para escritura Silver",
    );
  }
  return { adminUrl: adminUrlFromMedallion(med), source: "MEDALLION_DERIVED" };
}

export { PROJECT_REF, POOLER_HOST };
