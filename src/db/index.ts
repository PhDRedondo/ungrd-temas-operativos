import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as platformSchema from "./platform-schema";

const fullSchema = { ...schema, ...platformSchema };

/**
 * En Vercel NUNCA caer a localhost (enmascara DATABASE_URL vacío).
 * Local: default brew/docker.
 */
const connectionString =
  process.env.DATABASE_URL?.trim() ||
  (process.env.VERCEL
    ? ""
    : "postgresql://ungrd:ungrd@127.0.0.1:5432/ungrd_temas");

declare global {
  // eslint-disable-next-line no-var
  var __ungrdSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __ungrdDb: ReturnType<typeof drizzle<typeof fullSchema>> | undefined;
}

function createClient() {
  if (!connectionString) {
    // Cliente dummy: las queries fallarán con mensaje claro vía health.
    return postgres("postgresql://invalid:invalid@127.0.0.1:1/invalid", {
      max: 1,
      connect_timeout: 2,
    });
  }
  const isLocal = /127\.0\.0\.1|localhost/.test(connectionString);
  // Transaction pooler (6543) no soporta prepared statements bien.
  const usePrepare = isLocal || !/:(6543)\b/.test(connectionString);
  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: isLocal ? false : "require",
    prepare: usePrepare,
  });
}

const sql = globalThis.__ungrdSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__ungrdSql = sql;

export const db = globalThis.__ungrdDb ?? drizzle(sql, { schema: fullSchema });
if (process.env.NODE_ENV !== "production") globalThis.__ungrdDb = db;

export { schema, platformSchema, fullSchema };
