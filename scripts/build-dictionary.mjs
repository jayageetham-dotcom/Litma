// Builds Litma's dictionary + thesaurus from Olam's open datasets (https://olam.in/p/open):
//   • Datuk corpus        — Malayalam → Malayalam definitions        (ODbL)
//   • Olam EnMl           — English → Malayalam definitions          (ODbL)
//   • E.K. Kurup corpus   — English/Malayalam synonym sets           (CC BY-SA 4.0)
//
// Output: public/dict/{index.json, en/<shard>.json, ml/<shard>.json}
// served statically with the site, loaded on demand by the editor.
//
// Usage: node scripts/build-dictionary.mjs [--cache .dict-cache] [--out public/dict]
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const CACHE = opt("--cache", ".dict-cache");
const OUT = opt("--out", "public/dict");
const SOURCES = {
  datuk: "https://olam.in/files/datuk.tar.gz",
  enml: "https://olam.in/files/enml.tar.gz",
  ekkurup: "https://olam.in/files/ekkurup.tar.gz",
};

async function load(name) {
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, `${name}.tar.gz`);
  if (!existsSync(file)) {
    console.log(`downloading ${SOURCES[name]}`);
    const r = await fetch(SOURCES[name]);
    if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  return untar(gunzipSync(readFileSync(file)));
}

function untar(buf) {
  const files = {};
  let off = 0;
  while (off + 512 <= buf.length) {
    const name = buf.subarray(off, off + 100).toString("utf8").replace(/\0.*$/s, "");
    if (!name) break;
    const size = parseInt(buf.subarray(off + 124, off + 136).toString("utf8").replace(/\0.*$/s, "").trim() || "0", 8);
    files[name] = buf.subarray(off + 512, off + 512 + size).toString("utf8");
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}

// ── TSV (from_content, types, to_content) with "" escaping ──
function* tsv(text) {
  const lines = text.split("\n");
  for (let i = 1; i < lines.length; i++) {
    let line = lines[i];
    if (!line.trim()) continue;
    // quoted field may span lines
    while ((line.match(/"/g) || []).length % 2 === 1 && i + 1 < lines.length) line += "\n" + lines[++i];
    const cells = [];
    let cur = "",
      q = false;
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (q) {
        if (c === '"' && line[j + 1] === '"') {
          cur += '"';
          j++;
        } else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"' && cur === "") q = true;
      else if (c === "\t") {
        cells.push(cur);
        cur = "";
      } else cur += c;
    }
    cells.push(cur);
    if (cells.length >= 3) yield cells;
  }
}

const clean = (s) => s.replace(/­/g, "").replace(/\s+/g, " ").trim();
const mlHead = (s) => clean(s).replace(/[0-9]+$/, ""); // "അ1" → "അ"
const pos = (s) => s.replace(/[{}]/g, "").trim();

// ── E.K. Kurup YAML subset ──
function parseYamlList(s) {
  // "[[a, b, c], [d, e]]" → [["a","b","c"],["d","e"]]; items may be quoted with '…'
  const out = [];
  let cur = null,
    item = "",
    q = false,
    depth = 0;
  for (const c of s.trim()) {
    if (q) {
      if (c === "'") q = false;
      else item += c;
      continue;
    }
    if (c === "'") q = true;
    else if (c === "[") {
      depth++;
      if (depth === 2) cur = [];
    } else if (c === "]") {
      if (depth === 2) {
        if (item.trim()) cur.push(item.trim());
        item = "";
        out.push(cur);
        cur = null;
      }
      depth--;
    } else if (c === "," && depth === 2) {
      if (item.trim()) cur.push(item.trim());
      item = "";
    } else if (depth === 2) item += c;
  }
  return out;
}

function parseKurup(text) {
  const entries = [];
  let e = null,
    sense = null;
  for (const raw of text.split("\n")) {
    let m;
    if ((m = raw.match(/^- head: (.*)$/))) {
      e = { head: m[1].trim().replace(/^'(.*)'$/, "$1"), senses: [] };
      entries.push(e);
    } else if ((m = raw.match(/^\s+- pos: (.*)$/)) && e) {
      sense = { p: m[1].trim(), en: [], ml: [] };
      e.senses.push(sense);
    } else if ((m = raw.match(/^\s+(en|ml): (.*)$/)) && sense) {
      sense[m[1]] = parseYamlList(m[2]);
    }
  }
  return entries;
}

// ── sharding ──
// One file per first letter (≈100 files in total), split by second letter only when a
// letter's file would exceed ~2.5 MB. Fewer files keep FTP deploys fast and reliable.
const enKey = (w) => w.toLowerCase().trim();
const hex = (ch) => ch.codePointAt(0).toString(16);
const enFirst = (k) => (k[0] && /[a-z]/.test(k[0]) ? k[0] : "_");
const enSecond = (k) => (k[1] && /[a-z]/.test(k[1]) ? k[1] : "_");
const mlFirst = (k) => ([...k][0] ? hex([...k][0]) : "_");
const mlSecond = (k) => ([...k][1] ? hex([...k][1]) : "_");
const LIMIT = 2_500_000;

function shardAll(entries, first, second) {
  const sizes = {};
  for (const [k, v] of entries) sizes[first(k)] = (sizes[first(k)] ?? 0) + k.length * 3 + JSON.stringify(v).length;
  const split = new Set(Object.entries(sizes).filter(([, n]) => n > LIMIT).map(([f]) => f));
  const shards = {};
  for (const [k, v] of entries) {
    const f = first(k);
    const name = split.has(f) ? `${f}-${second(k)}` : f;
    (shards[name] ??= {})[k] = v;
  }
  return { shards, split: [...split] };
}

function push(map, k, v) {
  (map[k] ??= []).push(v);
}

async function main() {
  const t0 = Date.now();
  const [datukF, enmlF, kurupF] = await Promise.all([load("datuk"), load("enml"), load("ekkurup")]);
  const datukText = Object.entries(datukF).find(([n]) => /datuk/i.test(n) && !/readme|license/i.test(n))?.[1] ?? "";
  const enmlText = Object.entries(enmlF).find(([n]) => /enml/i.test(n) && !/readme|license/i.test(n))?.[1] ?? "";
  const kurupText = Object.entries(kurupF).find(([n]) => n.endsWith(".yml"))?.[1] ?? "";

  /** en[key] = { h: display head, d: { pos: [defs] }, s: [{p, en:[[]], ml:[[]]}] } */
  const en = new Map();
  /** ml[key] = { d: { pos: [defs] }, e: Set(english heads), r: [[enKey, senseIdx, synsetIdx]] } */
  const ml = new Map();
  const getEn = (k, h) => {
    let v = en.get(k);
    if (!v) en.set(k, (v = { h }));
    return v;
  };
  const getMl = (k) => {
    let v = ml.get(k);
    if (!v) ml.set(k, (v = {}));
    return v;
  };

  // Datuk: Malayalam → Malayalam
  let n = 0;
  for (const [from, types, to] of tsv(datukText)) {
    const k = mlHead(from);
    const def = clean(to);
    if (!k || !def) continue;
    const v = getMl(k);
    v.d ??= {};
    push(v.d, pos(types) || "-", def);
    n++;
  }
  console.log(`datuk: ${n} definitions`);

  // EnMl: English → Malayalam (and reverse: Malayalam word → English)
  n = 0;
  for (const [from, types, to] of tsv(enmlText)) {
    const h = clean(from);
    const def = clean(to);
    if (!h || !def) continue;
    const v = getEn(enKey(h), h);
    v.d ??= {};
    push(v.d, pos(types) || "-", def);
    if ([...def].length <= 30) {
      const r = getMl(def);
      (r.e ??= new Set()).add(h.toLowerCase());
    }
    n++;
  }
  console.log(`enml: ${n} definitions`);

  // E.K. Kurup: synsets
  const kurup = parseKurup(kurupText);
  n = 0;
  for (const entry of kurup) {
    const k = enKey(entry.head);
    const v = getEn(k, entry.head);
    v.s = entry.senses;
    entry.senses.forEach((s, si) =>
      s.ml.forEach((set, ji) =>
        set.forEach((w) => {
          const word = clean(w);
          if (!word) return;
          const r = getMl(word);
          r.r ??= [];
          if (r.r.length < 12) r.r.push([k, si, ji]);
          (r.e ??= new Set()).add(entry.head.toLowerCase());
          n++;
        })
      )
    );
  }
  console.log(`ekkurup: ${kurup.length} heads, ${n} Malayalam synonym links`);

  // finalise Malayalam entries
  const mlObj = {};
  for (const [k, v] of ml) {
    const o = {};
    if (v.d) o.d = v.d;
    if (v.e) o.e = [...v.e].slice(0, 15);
    if (v.r) o.r = v.r;
    mlObj[k] = o;
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(join(OUT, "en"), { recursive: true });
  mkdirSync(join(OUT, "ml"), { recursive: true });

  const { shards: enShards, split: enSplit } = shardAll([...en.entries()], enFirst, enSecond);
  const { shards: mlShards, split: mlSplit } = shardAll(Object.entries(mlObj), mlFirst, mlSecond);
  for (const [s, obj] of Object.entries(enShards)) writeFileSync(join(OUT, "en", `${s}.json`), JSON.stringify(obj));
  for (const [s, obj] of Object.entries(mlShards)) writeFileSync(join(OUT, "ml", `${s}.json`), JSON.stringify(obj));

  const index = {
    version: new Date().toISOString().slice(0, 10),
    format: 2,
    enSplit,
    mlSplit,
    counts: { en: en.size, ml: ml.size, enShards: Object.keys(enShards).length, mlShards: Object.keys(mlShards).length },
    sources: [
      { name: "Datuk corpus (Malayalam–Malayalam)", url: "https://olam.in/p/open/datuk", license: "ODbL" },
      { name: "Olam English–Malayalam", url: "https://olam.in/p/open/enml", license: "ODbL" },
      { name: "E.K. Kurup corpus (thesaurus)", url: "https://olam.in/p/open/ekkurup", license: "CC BY-SA 4.0" },
    ],
  };
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 1));
  console.log(`wrote ${index.counts.enShards} English + ${index.counts.mlShards} Malayalam shards to ${OUT} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((e) => {
  console.error("Dictionary build failed:", e.message);
  // Don't fail the site build — the dictionary panel explains that data is missing.
  process.exit(process.env.DICT_STRICT ? 1 : 0);
});
