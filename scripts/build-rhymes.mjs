// Builds the rhyme finder's files (പ്രാസം) from the built dictionary shards:
// /dict/rhyme/<s|e|f>-<hex>.json, each a list of Malayalam headwords that share a second-akshara
// consonant (s), a last akshara (e) or a first letter (f), best-known words first.
// Run after scripts/build-dictionary.mjs (it calls this at the end), or by hand:
//   node scripts/build-rhymes.mjs [--out apps/web/public/dict]
import { readdirSync, readFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { aksharas } = await import(pathToFileURL(join(root, "packages/shared/src/manglish.ts")).href);
const { rhymeKey, rhymePath, RHYME_KINDS } = await import(pathToFileURL(join(root, "packages/shared/src/rhyme.ts")).href);

/** Most words a single rhyme file keeps (the best known). */
const CAP = 2500;

// Words Litma never suggests by itself: entries that describe a caste or community, or abuse
// (owner's fairness rule). They can still be looked up in the dictionary.
const AVOID = /ജാതി|ജാതിക്കാര|സമുദായ|അസഭ്യ|തെറി|ശകാര|നിന്ദ|caste|tribe|abusive|obscene|vulgar|slur|insult|derogatory/i;

export function buildRhymes(dictDir) {
  const mlDir = join(dictDir, "ml");
  if (!existsSync(mlDir)) {
    console.log("rhymes: no dictionary shards, skipped");
    return;
  }
  /** word → how well known it is */
  const words = new Map();
  for (const f of readdirSync(mlDir)) {
    const shard = JSON.parse(readFileSync(join(mlDir, f), "utf8"));
    for (const [w, e] of Object.entries(shard)) {
      if (!/^[ഀ-ൿ‌‍]+$/.test(w) || /^[ാ-ൗ്ംഃ]/.test(w)) continue;
      const n = aksharas(w).length;
      if (n < 2 || n > 7) continue;
      const text = [...Object.values(e.d ?? {}).flat(), ...(e.e ?? [])].join(" ");
      if (AVOID.test(text)) continue;
      let s = 0;
      if (e.d) s += 2 + Math.min(Object.keys(e.d).length, 3) * 0.3;
      s += Math.min(e.e?.length ?? 0, 8) * 0.35;
      s += Math.min(e.r?.length ?? 0, 12) * 0.25;
      s -= Math.max(0, n - 4) * 0.4;
      if (s <= 0) continue;
      words.set(w, s);
    }
  }
  // spelling check: every single-word Malayalam headword, one file per dictionary shard (words/<shard>.txt)
  const wordsDir = join(dictDir, "words");
  rmSync(wordsDir, { recursive: true, force: true });
  mkdirSync(wordsDir, { recursive: true });
  let listed = 0;
  for (const f of readdirSync(mlDir)) {
    const shard = JSON.parse(readFileSync(join(mlDir, f), "utf8"));
    const list = Object.keys(shard).filter((w) => /^[ഀ-ൿ‌‍]+$/.test(w));
    listed += list.length;
    writeFileSync(join(wordsDir, f.replace(/\.json$/, ".txt")), list.join("\n"));
  }
  console.log(`spelling: ${listed} words`);

  const out = join(dictDir, "rhyme");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  let files = 0;
  for (const kind of RHYME_KINDS) {
    const buckets = new Map();
    for (const [w, s] of words) {
      const k = rhymeKey(w, kind);
      if (!k) continue;
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push([w, s]);
    }
    for (const [k, list] of buckets) {
      if (list.length < 2) continue;
      list.sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
      writeFileSync(join(dictDir, `${rhymePath(kind, k)}.json`), JSON.stringify(list.slice(0, CAP).map(([w]) => w)));
      files++;
    }
  }
  console.log(`rhymes: ${words.size} words in ${files} files`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf("--out");
  buildRhymes(i > 0 ? process.argv[i + 1] : join(root, "apps/web/public/dict"));
}
