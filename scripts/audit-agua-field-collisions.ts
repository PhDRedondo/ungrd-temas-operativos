/**
 * Detecta labels duplicados en Agua (mismo bug que Puentes fecha_inicio).
 * Uso: npx tsx scripts/audit-agua-field-collisions.ts
 */
import { config as theme } from "../src/themes/agua-y-saneamiento/theme";

function norm(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const fields = theme.fields;
const byLabel = new Map<string, string[]>();
const byNorm = new Map<string, string[]>();
for (const f of fields) {
  const lk = f.label.trim().toLowerCase();
  byLabel.set(lk, [...(byLabel.get(lk) || []), f.name]);
  const nk = norm(f.label);
  byNorm.set(nk, [...(byNorm.get(nk) || []), f.name]);
}

console.log(`fields=${fields.length}`);
console.log("=== DUPLICATE LABELS ===");
let dups = 0;
for (const [k, names] of [...byLabel.entries()].sort()) {
  const uniq = [...new Set(names)];
  if (uniq.length > 1) {
    dups++;
    console.log(JSON.stringify(k), "->", uniq.join(", "));
  }
}
console.log("=== DUPLICATE NORM LABELS ===");
for (const [k, names] of [...byNorm.entries()].sort()) {
  const uniq = [...new Set(names)];
  if (uniq.length > 1) console.log(k, "->", uniq.join(", "));
}
console.log(`\nduplicate_label_groups=${dups}`);
for (const form of theme.captureForms || []) {
  console.log(`form ${form.id} | ${form.capa} | fields=${(form.fieldNames || []).length}`);
}
