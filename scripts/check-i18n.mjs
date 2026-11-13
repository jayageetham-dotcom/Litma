#!/usr/bin/env node
/**
 * Checks the UI strings in packages/i18n/locales: every key in en.json (the source) must also be in
 * every other language, except the owner-only admin dashboard (admin.*), which stays English. Also
 * reports keys a language has that en.json doesn't (left over after a rename or removal).
 *
 *   npm run i18n:check          lists gaps, exits 1 when a writer-facing string is missing
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "../packages/i18n/locales");
const OWNER_ONLY = /^admin\./;

const flat = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
const load = (f) => new Map(flat(JSON.parse(readFileSync(join(DIR, f), "utf8"))));

const en = load("en.json");
let failed = false;
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "en.json")) {
  const other = load(f);
  const missing = [...en.keys()].filter((k) => !other.has(k) && !OWNER_ONLY.test(k));
  const extra = [...other.keys()].filter((k) => !en.has(k));
  // a placeholder like {count} must survive translation
  const params = [...en.keys()].filter((k) => other.has(k)).filter((k) => {
    const want = String(en.get(k)).match(/\{\w+\}/g)?.sort().join() ?? "";
    const got = String(other.get(k)).match(/\{\w+\}/g)?.sort().join() ?? "";
    return want !== got;
  });
  console.log(`${f}: ${missing.length} missing, ${extra.length} not in en.json, ${params.length} with different {placeholders}`);
  for (const k of missing) console.log(`  missing  ${k} = ${JSON.stringify(en.get(k))}`);
  for (const k of extra) console.log(`  extra    ${k}`);
  for (const k of params) console.log(`  params   ${k}: en ${JSON.stringify(en.get(k))} / ${JSON.stringify(other.get(k))}`);
  if (missing.length || params.length) failed = true;
}
process.exit(failed ? 1 : 0);
