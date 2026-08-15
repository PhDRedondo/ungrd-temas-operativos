/**
 * Soft-delete registros source='seed' (demo de src/db/seed.ts) en prod.
 * No hard-delete. No toca form/excel.
 *
 *   npx tsx scripts/_quarantine-seed-records.ts --dry-run
 *   npx tsx scripts/_quarantine-seed-records.ts --apply
 */
import { resolveAdminDatabaseUrl, loadMedallionEnv, maskDbUrl } from "./lib/medallion-db-url";
import postgres from "postgres";

loadMedallionEnv();

async function main() {
  const apply = process.argv.includes("--apply");
  const dry = process.argv.includes("--dry-run") || !apply;
  const { adminUrl, source } = resolveAdminDatabaseUrl();
  console.log("DB:", source, maskDbUrl(adminUrl));
  console.log(dry ? "MODE: dry-run" : "MODE: APPLY soft-delete");

  const sql = postgres(adminUrl, { max: 1, ssl: "require", prepare: false, connect_timeout: 30 });
  try {
    const before = await sql`
      SELECT theme_id, count(*)::int AS n
      FROM public.records
      WHERE deleted_at IS NULL AND source = 'seed'
      GROUP BY 1 ORDER BY n DESC`;
    const total = before.reduce((a, r) => a + Number(r.n), 0);
    console.log(`Alive seed rows: ${total}`);
    console.table(before);

    if (dry) {
      console.log("Dry-run OK. Re-run with --apply to soft-delete.");
      return;
    }

    const updated = await sql`
      UPDATE public.records
      SET deleted_at = now(), updated_at = now()
      WHERE deleted_at IS NULL AND source = 'seed'
      RETURNING id, theme_id`;
    console.log(`Soft-deleted: ${updated.length}`);

    const after = await sql`
      SELECT count(*)::int AS alive_seed
      FROM public.records
      WHERE deleted_at IS NULL AND source = 'seed'`;
    console.log("Alive seed after:", after[0]);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
