import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import * as platformSchema from "./platform-schema";

const fullSchema = { ...schema, ...platformSchema };

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://ungrd:ungrd@127.0.0.1:5432/ungrd_temas";

declare global {
  // eslint-disable-next-line no-var
  var __ungrdSql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __ungrdDb: ReturnType<typeof drizzle<typeof fullSchema>> | undefined;
}

function createClient() {
  return postgres(connectionString, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

const sql = globalThis.__ungrdSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalThis.__ungrdSql = sql;

export const db = globalThis.__ungrdDb ?? drizzle(sql, { schema: fullSchema });
if (process.env.NODE_ENV !== "production") globalThis.__ungrdDb = db;

export { schema, platformSchema, fullSchema };
