// Collects every label Litma's own interface uses (UI strings in packages/i18n, aria-labels, titles,
// option labels and button text written in apps/web/src) into apps/web/public/track-labels.json.
// The usage tracker (apps/web/src/lib/analytics.ts) records a click's label only when it matches one of
// these, so text a writer typed (titles, names, their writing) can never be sent.
// Run by the web app's dev and build scripts; the output is git-ignored.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const labels = new Set();

/** Same rule as normaliseLabel() in analytics.ts. */
export const normalise = (s) =>
  s
    .replace(/\s+/g, " ")
    .replace(/\s*\((?:Ctrl|⌘|Cmd|Alt|Shift|Esc|Enter|Tab)[^)]*\)\s*$/i, "")
    .replace(/[\s:…·.,]+$/u, "")
    .trim();

function add(s) {
  const v = normalise(String(s));
  if (v.length >= 2 && v.length <= 60 && /\p{L}/u.test(v) && !/[{}<>=;]|\$\{|https?:/.test(v)) labels.add(v);
}

// 1. interface strings in every language
function walkJson(v) {
  if (typeof v === "string") {
    // drop {placeholders}: keep the text before the first one ("Delete {title}" → "Delete")
    const head = v.split("{")[0];
    add(head);
  } else if (v && typeof v === "object") Object.values(v).forEach(walkJson);
}
const locales = join(root, "packages/i18n/locales");
for (const f of readdirSync(locales).filter((f) => f.endsWith(".json"))) walkJson(JSON.parse(readFileSync(join(locales, f), "utf8")));

// 2. labels written in the components (not sample texts or templates in lib/)
const SKIP = /[\\/](art|landing)[\\/]|TemplatePreview|book-samples|templates/;
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(f) && !SKIP.test(p)) scan(readFileSync(p, "utf8"));
  }
}
function scan(src) {
  for (const m of src.matchAll(/\b(?:aria-label|title|data-track)="([^"]+)"/g)) add(m[1]);
  // template labels: keep the fixed start ("Delete ${b.title}" → "Delete")
  for (const m of src.matchAll(/\b(?:aria-label|title)=\{`([^`$]*)/g)) add(m[1]);
  for (const m of src.matchAll(/\b(?:aria-label|title)=\{"([^"]+)"\}/g)) add(m[1]);
  for (const m of src.matchAll(/\b(?:label|title|tip|hint)\s*:\s*"([^"\n]+)"/g)) add(m[1]);
  // JSX text between tags on one line: <button …>Insert page</button>
  for (const m of src.matchAll(/>\s*([^<>{}\n]{2,60}?)\s*</g)) add(m[1]);
}
walk(join(root, "apps/web/src/app"));
walk(join(root, "apps/web/src/components"));

const out = join(root, "apps/web/public/track-labels.json");
writeFileSync(out, JSON.stringify([...labels].sort()) + "\n");
console.log(`track-labels.json → ${labels.size} interface labels`);
