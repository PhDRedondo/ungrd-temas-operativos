/**
 * Imprime la DATABASE_URL correcta para Vercel (pooler Session :5432),
 * reutilizando el password que ya funciona en MEDALLION_DATABASE_URL.
 *
 *   npx tsx scripts/print-vercel-database-url.ts
 *
 * Copia la línea postgresql://... en Vercel → DATABASE_URL (Production)
 * y haz Redeploy. No subas esta salida a git ni al chat.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

function main() {
  const src = process.env.MEDALLION_DATABASE_URL || "";
  if (!src) {
    console.error("Falta MEDALLION_DATABASE_URL en .env.local");
    process.exit(1);
  }
  const u = new URL(src.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"));
  const password = u.password;
  if (!password) {
    console.error("MEDALLION_DATABASE_URL sin password");
    process.exit(1);
  }
  const ref = "vbxvqctdemtnmkifrxeo";
  const host = "aws-1-us-west-2.pooler.supabase.com";
  const port = "5432";
  const user = `postgres.${ref}`;
  const url = `postgresql://${user}:${encodeURIComponent(decodeURIComponent(password))}@${host}:${port}/postgres?sslmode=require`;

  console.log("# Pega EXACTO esto en Vercel → Environment Variables → DATABASE_URL");
  console.log("# Environments: Production (y Preview si aplica)");
  console.log("# Luego Deployments → … → Redeploy (sin usar cache si puedes)");
  console.log("");
  console.log(url);
  console.log("");
  console.log("# Tras redeploy: https://ungrd-manejo-phi.vercel.app/api/health");
  console.log('# Esperado: "db":"up" y "port":"5432"');
}

main();
