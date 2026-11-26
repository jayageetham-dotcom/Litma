/**
 * Regression check for MlSpeller.quoted() (quotative എന്ന് joins, packages/shared/src/mlmorph.ts)
 * against the real mlmorph transducer.
 *
 *   node scripts/build-mlmorph.mjs          # once: makes supabase/functions/litma-spell/data
 *   npx tsx scripts/spell-lab/quoted-check.ts [data dir]
 *
 * Exits 1 when a correct word is flagged, a known-bad word passes, the prose sample
 * (prose.txt, everyday writing from all of Kerala's communities) gets more false alarms than
 * PROSE_MAX, or misspellings newly let through by quoted() rise above FALSE_PASS_MAX.
 * Lower the two ceilings when the engine gets better.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { MlMorph, MlSpeller, looksForeign, malayalamWords, normaliseWord } from "../../packages/shared/src/mlmorph.ts";

const here = dirname(fileURLToPath(import.meta.url));
const data = process.argv[2] ?? process.env.LITMA_SPELL_DATA ?? join(here, "../../supabase/functions/litma-spell/data");
if (!existsSync(join(data, "mlmorph.bin.gz"))) {
  console.error(`No transducer in ${data}. Run: node scripts/build-mlmorph.mjs`);
  process.exit(2);
}
const morph = new MlMorph(gunzipSync(readFileSync(join(data, "mlmorph.bin.gz"))));
const mistakes: Record<string, string> = JSON.parse(readFileSync(join(data, "mistakes.json"), "utf8"));
const speller = new MlSpeller(morph, mistakes);
const ok = (w: string) => speller.check(w).ok;
/** the verdict without quoted(): mlmorph alone */
const plain = (w: string) => {
  const n = normaliseWord(w);
  return !mistakes[n] && (morph.accepts(n) || looksForeign(n));
};

let failed = 0;
const fail = (msg: string) => {
  failed++;
  console.log(`FAIL ${msg}`);
};

// 1. correct chains that must be ok
const MUST_OK = `കാണാനില്ലെന്ന് കാണാനില്ലെന്നു കാണാനില്ലെന്ന കാണാനില്ലെന്നും കാണാനില്ലെന്നോ അറിയില്ലെന്ന് വരില്ലെന്ന്
പറഞ്ഞില്ലെന്ന് കാണാനാവില്ലെന്ന് വേണ്ടെന്ന് ഒരുങ്ങിയില്ലെന്ന് ജയിച്ചില്ലെന്ന് കുറഞ്ഞില്ലെന്ന് വൈകില്ലെന്നും കണ്ടില്ലെന്ന്
വിഷമിക്കേണ്ടെന്ന് പോകേണ്ടെന്ന് തികഞ്ഞില്ലെന്ന് കണ്ടിട്ടില്ലെന്ന് വായിക്കുന്നില്ലെന്ന് സമ്മതിച്ചില്ലെന്ന് ഒന്നുമില്ലെന്ന്
ആരുമില്ലെന്ന് സമയമില്ലെന്ന് മറക്കാനാവില്ലെന്ന് ഇല്ലെന്ന് ആണെന്ന് ഉണ്ടെന്ന് വരുമെന്ന് വേണമെന്ന് പോയെന്ന് വന്നെന്ന്`.split(/\s+/);
for (const w of MUST_OK) if (!ok(w)) fail(`correct word flagged: ${w}`);

// 2. not words: must stay flagged
const MUST_FLAG = "കാണാനില്ലെന്ന്ന് ലെന്ന് പെരുന്നാൾെന്ന് കാണാനില്ലെന്ന്‌ന്".split(/\s+/);
for (const w of MUST_FLAG) if (ok(w)) fail(`non-word accepted: ${w}`);

// 3. everyday prose: false alarms
const PROSE_MAX = 22; // 26 Nov 2026: 22 of 345 words (mlmorph alone: 33)
const words = malayalamWords(readFileSync(join(here, "prose.txt"), "utf8")).map((x) => x.word);
const before = words.filter((w) => !plain(w)).length;
const after = words.filter((w) => !ok(w));
console.log(`prose: ${words.length} words, flagged ${before} by mlmorph alone, ${after.length} with quoted()`);
if (after.length > PROSE_MAX) fail(`prose false alarms ${after.length} > ${PROSE_MAX}: ${after.join(" ")}`);

// 4. misspellings of chain words that only quoted() lets through
const FALSE_PASS_MAX = 122; // 26 Nov 2026: 122 of 811 that mlmorph alone catches (15%)
const BASES = `ഇല്ല കാണാനില്ല അറിയില്ല വരില്ല പറഞ്ഞില്ല പോയില്ല കിട്ടിയില്ല തോന്നിയില്ല ഉറങ്ങിയില്ല കഴിഞ്ഞില്ല സമ്മതിച്ചില്ല
കേട്ടില്ല കണ്ടില്ല വന്നില്ല തന്നില്ല ചെയ്തില്ല മിണ്ടിയില്ല കഴിക്കില്ല പോകില്ല ആവില്ല കാണാനാവില്ല പറയാനാവില്ല മറക്കാനാവില്ല
സഹിക്കാനാവില്ല ഓർമയില്ല പേടിയില്ല സമയമില്ല പണമില്ല ആരുമില്ല ഒന്നുമില്ല വേണ്ട പോകേണ്ട പറയേണ്ട കരയേണ്ട വിഷമിക്കേണ്ട
വന്ന പോയ പറഞ്ഞ കണ്ട കേട്ട ചെയ്ത മരിച്ച ജയിച്ച തോറ്റ നിന്ന ഇരുന്ന കരഞ്ഞ ചിരിച്ച ഓടിയ പഠിച്ച എഴുതിയ`.split(/\s+/);
const SWAPS: [string, string][] = [
  ["ി", "ീ"], ["ീ", "ി"], ["ു", "ൂ"], ["ൂ", "ു"], ["െ", "േ"], ["േ", "െ"], ["ൊ", "ോ"], ["ോ", "ൊ"], ["ാ", ""],
  ["ന", "ണ"], ["ണ", "ന"], ["ല", "ള"], ["ള", "ല"], ["ര", "റ"], ["റ", "ര"], ["ത", "ട"], ["ശ", "ഷ"], ["ഷ", "സ"],
];
function* misspell(base: string) {
  const ch = [...base];
  for (let i = 0; i < ch.length; i++) {
    for (const [a, b] of SWAPS) if (ch[i] === a) yield [...ch.slice(0, i), b, ...ch.slice(i + 1)].join("");
    if (ch[i] === "്") {
      yield [...ch.slice(0, i), ...ch.slice(i + 1)].join(""); // ് left out
      if (ch[i + 1] === ch[i - 1]) yield [...ch.slice(0, i), ...ch.slice(i + 2)].join(""); // doubling left out
    }
  }
}
const seen = new Set<string>();
let caught = 0;
const through: string[] = [];
for (const base of BASES)
  for (const end of ["്", "ു", "ും"]) {
    const good = base + "െന്ന" + end;
    for (const m of misspell(base)) {
      const w = m + "െന്ന" + end;
      if (w === good || seen.has(w)) continue;
      seen.add(w);
      if (plain(w)) continue;
      caught++;
      if (ok(w)) through.push(w);
    }
  }
console.log(`misspellings: ${seen.size}, mlmorph alone flags ${caught}, quoted() lets ${through.length} through`);
if (through.length > FALSE_PASS_MAX) fail(`false passes ${through.length} > ${FALSE_PASS_MAX}: ${through.slice(0, 20).join(" ")}`);

// 5. known false passes (not failing yet; see docs/work/claude-context-menu-spelling.md)
const KNOWN = "അമ്മെന്ന് സീതെന്ന് ആയിഷെന്ന് പുഴെന്ന് വരിലെന്ന് കണ്ടിലെന്ന് വന്നിലെന്ന് പണമിലെന്ന് മരിചെന്ന്".split(" ");
console.log(`known false passes still accepted: ${KNOWN.filter(ok).join(" ") || "none"}`);

console.log(failed ? `${failed} failure(s)` : "quoted-check: all passed");
process.exit(failed ? 1 : 0);
