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
// Forms from the word list have no definition to test, so the word itself is tested: anything that
// names caste, community or a religion's people, or abuse, stays out.
const FORM_AVOID =
  /ജാതി|ജാത്യ|സമുദായ|വർഗ്ഗീയ|വർഗീയ|ഗോത്രവർഗ|മതക്കാ|മതസ്ഥ|മതവിശ്വാസി|മതനേതാ|മതസ്പർ|മതതീവ്ര|മതവിദ്വേ|മതപരിവർ|മതംമാ|ഹിന്ദു|ക്രിസ്ത്യ|ക്രിസ്തുമത|ബുദ്ധമത|ജൈനമത|ഇസ്ലാ|ഇസ്‌ലാ|മുസ്ലി|മുസ്‌ലി|സിഖ്|ദളിത|ആദിവാസി|തെറി|അസഭ്യ|ജാതീയ|ബ്രാഹ്മണ|ക്ഷത്രിയ|ശൂദ്ര|ഈഴവ|നായര|നായർ|വാര്യ|മേനോ|നമ്പൂതിരി|നമ്പ്യാ|പണിക്കര|പണിക്കർ|കുറുപ്പ|പുലയ|പറയർ|പറയന|പറയൻ|കുറവർ|കുറവന|കുറവൻ|തണ്ടാ|ചോവ|തീയർ|മുക്കുവ|അരയർ|അരയൻ|അരയന്മാ|ആശാരി|മൂശാരി|തട്ടാൻ|തട്ടാന|കൊല്ലൻ|കൊല്ലന|നാടാർ|ചെട്ടിയാ|റാവുത്ത|മാപ്പിള|സുറിയാനി|ലത്തീൻ|പിള്ള(?!േ)/;

/** How many of the most used words (the Manglish word list) may join the rhyme files. */
const USED_TOP = 60000;

/**
 * Poets end lines on forms, not headwords (മഴയിൽ, പറഞ്ഞു, കാണുന്നു). The most used words of the
 * offline Manglish word list (/dict/manglish-words.txt, most used first, built before this step)
 * join the rhyme files when they are a form of a dictionary headword (they start with one of at
 * least two aksharas) and not of a headword left out above. Common forms then rank with the
 * well-known headwords; a headword that is also common rises.
 */
function addUsedForms(dictDir, words, avoid) {
  const file = join(dictDir, "manglish-words.txt");
  if (!existsSync(file)) {
    console.log("rhymes: no manglish-words.txt, dictionary headwords only");
    return;
  }
  // headwords by their first two aksharas, to test "starts with a headword" quickly
  const heads = new Map();
  const index = (w, set) => {
    const a = aksharas(w);
    if (a.length < 2) return;
    const k = a[0].text + a[1].text;
    let b = heads.get(k);
    if (!b) heads.set(k, (b = []));
    b.push([w, set]);
  };
  for (const w of words.keys()) index(w, "ok");
  for (const w of avoid) index(w, "avoid");
  const all = readFileSync(file, "utf8").split("\n").filter(Boolean);
  // a headword nobody writes (not in the word list at all) moves down, behind words in use; it stays
  const inUse = new Set(all);
  for (const [w, s] of words) if (!inUse.has(w)) words.set(w, Math.max(0.05, s - 2));
  const used = all.slice(0, USED_TOP);
  let added = 0;
  used.forEach((w, rank) => {
    const a = aksharas(w);
    if (a.length < 2 || a.length > 7 || FORM_AVOID.test(w)) return;
    const cands = heads.get(a[0].text + a[1].text) ?? [];
    // it must start with a headword, and with no left-out headword at all (ജാതിക്കാർ stays out even
    // though a longer harmless headword may also match)
    let ok = false;
    for (const [h, set] of cands) {
      if (!w.startsWith(h)) continue;
      if (set === "avoid") return;
      ok = true;
    }
    if (!ok) return;
    const use = 4 - Math.log10(rank + 1); // 4 for the most used word, 0 at the 10,000th
    if (words.has(w)) words.set(w, words.get(w) + Math.max(0, use));
    else if (use + 1 > 0) {
      words.set(w, use + 1);
      added++;
    }
  });
  console.log(`rhymes: ${added} used forms added from the word list`);
}

export function buildRhymes(dictDir) {
  const mlDir = join(dictDir, "ml");
  if (!existsSync(mlDir)) {
    console.log("rhymes: no dictionary shards, skipped");
    return;
  }
  /** word → how well known it is */
  const words = new Map();
  /** headwords whose definitions mention caste, community or abuse: never suggested, nor their forms */
  const avoid = new Set();
  for (const f of readdirSync(mlDir)) {
    const shard = JSON.parse(readFileSync(join(mlDir, f), "utf8"));
    for (const [w, e] of Object.entries(shard)) {
      if (!/^[ഀ-ൿ‌‍]+$/.test(w) || /^[ാ-ൗ്ംഃ]/.test(w)) continue;
      const n = aksharas(w).length;
      if (n < 2 || n > 7) continue;
      const text = [...Object.values(e.d ?? {}).flat(), ...(e.e ?? [])].join(" ");
      if (AVOID.test(text)) {
        avoid.add(w);
        continue;
      }
      let s = 0;
      if (e.d) s += 2 + Math.min(Object.keys(e.d).length, 3) * 0.3;
      s += Math.min(e.e?.length ?? 0, 8) * 0.35;
      s += Math.min(e.r?.length ?? 0, 12) * 0.25;
      s -= Math.max(0, n - 4) * 0.4;
      if (s <= 0) continue;
      words.set(w, s);
    }
  }
  for (const w of words.keys()) if (FORM_AVOID.test(w)) words.delete(w);
  addUsedForms(dictDir, words, avoid);

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
