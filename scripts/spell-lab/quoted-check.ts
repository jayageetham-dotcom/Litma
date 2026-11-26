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
ആരുമില്ലെന്ന് സമയമില്ലെന്ന് മറക്കാനാവില്ലെന്ന് ഇല്ലെന്ന് ആണെന്ന് ഉണ്ടെന്ന് വരുമെന്ന് വേണമെന്ന് പോയെന്ന് വന്നെന്ന്
കാണാനില്ലെന്നാണ് കാണാനില്ലെന്നുള്ള അറിയില്ലെന്നായിരുന്നു വരില്ലെന്നാണോ കിട്ടില്ലെന്നുമാണ് പറഞ്ഞില്ലെന്നായി പോകേണ്ടെന്നാണ് വേണ്ടെന്നുള്ള കണ്ടിട്ടില്ലെന്നല്ലേ
വരില്ലെന്നത് ഇല്ലെന്നതാണ് പറ്റില്ലെന്നതിനാൽ അറിയില്ലെന്നൊക്കെ വരില്ലെന്നുതന്നെ കിട്ടില്ലെന്നുപോലും നടക്കില്ലെന്നാകും ആരുമില്ലെന്നുമുള്ള
വരില്ലെന്നോർത്ത് ഇല്ലെന്നറിയാം വരില്ലെന്നമട്ടിൽ വേണ്ടെന്നുവെച്ചു വേണ്ടെന്നുവച്ചു കാണാനില്ലെന്നാണെന്ന് മരിക്കില്ലെന്നാവും`.split(/\s+/);
for (const w of MUST_OK) if (!ok(w)) fail(`correct word flagged: ${w}`);

// 2. not words: must stay flagged
const MUST_FLAG = `കാണാനില്ലെന്ന്ന് ലെന്ന് പെരുന്നാൾെന്ന് കാണാനില്ലെന്ന്‌ന് കാണാനില്ലെന്നാണ്ണ് അമ്മെന്നാണ് വരിലെന്നുള്ള കാണാനില്ലെന്നxയ
വരില്ലെന്നമ്മ വരില്ലെന്നവൻ പോകേണ്ടെന്നുല്ല പോകണ്ടെന്നാണ് പോകെണ്ടെന്നാണ് കണ്ടിലെന്നുള്ള സീതെന്നുള്ള കാണാനില്ലെന്നുള്ളള കാണാനില്ലെന്നായിരുന്നുു`.split(/\s+/);
for (const w of MUST_FLAG) if (ok(w)) fail(`non-word accepted: ${w}`);

// 3. everyday prose: false alarms
const PROSE_MAX = 21; // 26 Nov 2026: 21 of 345 words with the long endings (22 before them; mlmorph alone: 33)
const words = malayalamWords(readFileSync(join(here, "prose.txt"), "utf8")).map((x) => x.word);
const before = words.filter((w) => !plain(w)).length;
const after = words.filter((w) => !ok(w));
console.log(`prose: ${words.length} words, flagged ${before} by mlmorph alone, ${after.length} with quoted()`);
if (after.length > PROSE_MAX) fail(`prose false alarms ${after.length} > ${PROSE_MAX}: ${after.join(" ")}`);

// 4. misspellings of chain words that only quoted() lets through
const FALSE_PASS_MAX = 73; // 26 Nov 2026: 73 of 1628 (4.5%) with the long endings too (34 of 811 before them); every one has a base mlmorph itself accepts (പറയനാവില്ല, കേടടില്ല)
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
  for (const end of ["്", "ു", "ും", "ാണ്", "ുള്ള", "ായിരുന്നു"]) {
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
if (process.env.SHOW) console.log(through.join(" "));
if (through.length > FALSE_PASS_MAX) fail(`false passes ${through.length} > ${FALSE_PASS_MAX}: ${through.slice(0, 20).join(" ")}`);

// 5. false passes the tester found (26 Nov): none may come back
const KNOWN = "അമ്മെന്ന് സീതെന്ന് ആയിഷെന്ന് പുഴെന്ന് വരിലെന്ന് കണ്ടിലെന്ന് വന്നിലെന്ന് പണമിലെന്ന് മരിചെന്ന്".split(" ");
const back = KNOWN.filter(ok);
console.log(`known false passes still accepted: ${back.join(" ") || "none"}`);
if (back.length) fail(`false passes came back: ${back.join(" ")}`);

// 6. slips in the ending, and garbage endings that mlmorph reads after ഇല്ലെന്ന as compounds
//    (ഇ<dem>അല്ല്<n>എന്നു്<postp>… + ഓ<cnj>അര, n-v-compounds, vowel signs read as vowels): tester, 26 Nov.
//    All of these are wrong, but quoted() accepts them because accepts("ഇല്ലെന്ന" + tail) is true.
//    The ceiling stops it getting worse; lower it (to 0) when the tail test is made stricter.
const TAIL_SLIP_MAX = 0; // 26 Nov 2026: 0 of 29 once quotativeTail() needs a plain reading (was 29 of 29)
const SLIP_TAILS = "യിരുന്നു ാനോ ാണൊ െന്ന് െന്നാണ് ോര ട നട റി ുാക".split(" "); // എന്നയിരുന്നു, doubled എന്ന, junk
const SLIP_BASES = "കാണാനില്ല വരില്ല പോകേണ്ട".split(" ");
const slips = SLIP_BASES.flatMap((b) => SLIP_TAILS.map((t) => b + "െന്ന" + t)).filter((w) => !plain(w));
const slipThrough = slips.filter(ok);
console.log(`ending slips: ${slips.length}, accepted ${slipThrough.length}${process.env.SHOW ? ": " + slipThrough.join(" ") : ""}`);
if (slipThrough.length > TAIL_SLIP_MAX) fail(`ending slips accepted ${slipThrough.length} > ${TAIL_SLIP_MAX}: ${slipThrough.slice(0, 20).join(" ")}`);

console.log(failed ? `${failed} failure(s)` : "quoted-check: all passed");
process.exit(failed ? 1 : 0);
