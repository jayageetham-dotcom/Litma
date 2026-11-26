#!/usr/bin/env node
// Builds apps/web/public/dict/manglish-words.txt: the word list behind ranked offline Manglish
// suggestions (packages/shared/src/manglish-rank.ts). One Malayalam word per line, most used first.
//
// Source: "Word Frequency Profile of Malayalam" (Kavya Manohar, CC BY 4.0), word counts from
// AI4Bharat's IndicCorp: https://huggingface.co/datasets/kavyamanohar/Malayalam-word-freq
// Pinned to one revision and checked by sha256. Credited in THIRD_PARTY_NOTICES.md and the
// help guide's credits section.
//
//   node scripts/build-manglish-words.mjs [--source ml.vocabfreq.tsv] [--cache .dict-cache] [--words 150000]
//
// The 421 MB source is downloaded once into the cache folder (CI caches it). Not committed.

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REVISION = "bb8f0adfd7d8968d37e2be7a7bfa22ec7382f61b";
const URL = `https://huggingface.co/datasets/kavyamanohar/Malayalam-word-freq/resolve/${REVISION}/ml.vocabfreq.tsv`;
const SHA256 = "c0d40013f45a1b1f7fb0e33066b92d2fd3e1c5e96317bf072c8c87dc5d61e0d4";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const WORDS = Number(arg("words", 150000));
const cache = join(root, arg("cache", ".dict-cache"));
const out = join(root, "apps/web/public/dict/manglish-words.txt");

async function sha256(file) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}

async function source() {
  const given = arg("source");
  if (given) return given;
  const file = join(cache, "ml.vocabfreq.tsv");
  if (existsSync(file) && (await sha256(file)) === SHA256) return file;
  mkdirSync(cache, { recursive: true });
  console.log("Downloading the Malayalam word frequencies (421 MB)…");
  const r = await fetch(URL);
  if (!r.ok || !r.body) throw new Error(`download failed: ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(file + ".part"));
  renameSync(file + ".part", file);
  const got = await sha256(file);
  if (got !== SHA256) throw new Error(`checksum mismatch: ${got}`);
  return file;
}

// Malayalam letters only, well formed
const C = "ക-ഹ";
const SIGNS = "ാ-ൌൗൢൣ";
const V = "്";
const ONLY_ML = /^[ഀ-ൿ‌‍]+$/;
const BAD = [
  new RegExp(`^[${SIGNS}${V}ംഃ]`), // starts with a sign, virama, ം or ഃ
  new RegExp(`[^${C}഼][${SIGNS}${V}]`), // a sign or virama not after a consonant
  new RegExp(`[${SIGNS}][${SIGNS}${V}]`), // two signs in a row (old ു്)
  /്്/,
  /[‌‍]{2}/,
  /(.)\1\1/,
  /ഃ/, // ഃ: abbreviations and old spellings
  /(?<=.)[അ-ഔ]/, // an independent vowel inside a word: abbreviations (കെസിആർ)
  new RegExp(`^([${C}])്\\1`), // starts with a doubled letter: a broken piece (ക്കു)
  /^.$/,
];
const OLD_CHILLU = [
  ["ണ്‍", "ൺ"], ["ന്‍", "ൻ"], ["ര്‍", "ർ"], ["ല്‍", "ൽ"], ["ള്‍", "ൾ"], ["ക്‍", "ൿ"],
];

/** The spelling Litma writes: atomic chillu, modern au (ൗ), no joiners. */
export function normalise(w) {
  for (const [a, b] of OLD_CHILLU) w = w.split(a).join(b);
  return w.replace(/ൌ/g, "ൗ").replace(/[‌‍]/g, "");
}

const file = await source();
const seen = new Set();
const list = [];
const lines = createInterface({ input: createReadStream(file, "utf8"), crlfDelay: Infinity });
for await (const line of lines) {
  const tab = line.indexOf("\t");
  const raw = tab < 0 ? line : line.slice(0, tab);
  if (!ONLY_ML.test(raw) || BAD.some((re) => re.test(raw))) continue;
  const w = normalise(raw);
  if (seen.has(w)) continue;
  seen.add(w);
  list.push(w);
  if (list.length >= WORDS) break;
}
lines.close();
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, list.join("\n") + "\n");
console.log(`manglish-words.txt: ${list.length} words`);
