/**
 * Setup completo para prueba oficial (Supabase u otro Postgres remoto).
 *
 * Uso:
 *   DATABASE_URL="postgresql://..." npm run db:official-setup
 *
 * Requiere: .env.local con DATABASE_URL apuntando a Supabase (conexión directa, puerto 5432).
 */
import "dotenv/config";
import { spawnSync } from "child_process";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ DATABASE_URL no definido. Configúralo en .env.local");
  process.exit(1);
}

function run(label: string, cmd: string, args: string[]) {
  console.log(`\n▸ ${label}`);
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`\n❌ Falló: ${label}`);
    process.exit(r.status || 1);
  }
}

console.log("UNGRD — setup oficial (Postgres remoto)");
console.log("Destino:", url.replace(/:[^:@/]+@/, ":****@"));

run("Schema legacy (drizzle push)", "npx", ["drizzle-kit", "push"]);
run("Seed legacy (temas + registros demo)", "npx", ["tsx", "src/db/seed.ts"]);
run("Migración plataforma (esquemas iam/core/workflow…)", "psql", [
  url,
  "-f",
  "drizzle/migrations/0001_platform_schemas.sql",
]);
run("Seed plataforma (dependencias + workflow piloto)", "npx", [
  "tsx",
  "src/db/seed-platform.ts",
]);

console.log("\n✅ Setup oficial completado.");
console.log("Siguiente: npm run dev  →  npm run harness");
