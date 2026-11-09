#!/usr/bin/env node
/**
 * Builds the data for Litma's Malayalam spelling engine (supabase/functions/litma-spell) from
 * Swathanthra Malayalam Computing's mlmorph (MIT licence, https://gitlab.com/smc/mlmorph):
 *
 *   mlmorph.bin.gz   the morphology transducer (malayalam.a, SFST's binary format) re-laid out as
 *                    flat typed arrays, so the server loads it with no parsing
 *   mistakes.json    mlmorph's list of common misspellings → the standard spelling
 *
 * The pinned wheel is downloaded from PyPI and checked against its sha256. Nothing is committed:
 * the deploy job runs this before `supabase functions deploy litma-spell`.
 *
 *   node scripts/build-mlmorph.mjs [--wheel path/to/mlmorph.whl] [--out dir]
 *
 * Layout of mlmorph.bin (little-endian, every array 4-byte aligned):
 *   "LMF1" | u32 nodes | u32 arcs | u32 symbolsJsonBytes | symbols JSON (code → string) | pad
 *   u8[nodes] final | pad | u32[nodes+1] first arc of each node | u32[arcs] target
 *   u16[arcs] surface symbol | u16[arcs] analysis symbol
 * Arcs of a node are sorted by their surface symbol, epsilon (0) first.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync, inflateRawSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = "1.4.3";
const WHEEL_URL = `https://files.pythonhosted.org/packages/py3/m/mlmorph/mlmorph-${VERSION}-py3-none-any.whl`;
const WHEEL_SHA256 = "362940f23b2072f242802606829e2427a45df5ade260ee3dd85e15db7422a6ef";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
};
const OUT = arg("--out") ?? join(ROOT, "supabase/functions/litma-spell/data");

/** Read one file out of a zip (the wheel) without any dependency. */
function unzip(zip, wanted) {
  // end of central directory
  let eocd = zip.length - 22;
  while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("not a zip file");
  const count = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = zip.readUInt16LE(p + 10);
    const size = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const name = zip.toString("utf8", p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const lNameLen = zip.readUInt16LE(local + 26);
      const lExtraLen = zip.readUInt16LE(local + 28);
      const start = local + 30 + lNameLen + lExtraLen;
      const data = zip.subarray(start, start + size);
      return method === 0 ? Buffer.from(data) : inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} not found in the wheel`);
}

async function wheel() {
  const local = arg("--wheel");
  if (local) return readFileSync(local);
  const res = await fetch(WHEEL_URL);
  if (!res.ok) throw new Error(`Could not download mlmorph ${VERSION}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const sum = createHash("sha256").update(buf).digest("hex");
  if (sum !== WHEEL_SHA256) throw new Error(`mlmorph wheel checksum mismatch: ${sum}`);
  return buf;
}

/** SFST's standard binary transducer (Transducer::store in SFST's fst.cpp) → flat arrays. */
function readSfst(buf) {
  let p = 0;
  if (String.fromCharCode(buf[p++]) !== "a") throw new Error("not an SFST standard transducer");
  const nodes = buf.readUInt32LE(p);
  p += 4;
  const final = new Uint8Array(nodes);
  const first = new Uint32Array(nodes + 1);
  const count = new Uint32Array(nodes);
  // every arc is 8 bytes on disk, so this bounds the arc count
  const maxArcs = Math.ceil(buf.length / 8);
  const target = new Uint32Array(maxArcs);
  const lower = new Uint16Array(maxArcs);
  const upper = new Uint16Array(maxArcs);
  const seen = new Uint8Array(nodes);
  let arcs = 0;
  // nodes are written depth first: a node's record, then for each arc its label, its target and,
  // the first time that target is met, the target's own record (and so on), all inline
  const readInfo = (idx) => {
    final[idx] = buf[p];
    const n = buf.readUInt16LE(p + 1);
    p += 3;
    first[idx] = arcs;
    count[idx] = n;
    arcs += n;
    return { idx, n, k: 0 };
  };
  seen[0] = 1;
  const stack = [readInfo(0)];
  while (stack.length) {
    const top = stack[stack.length - 1];
    if (top.k === top.n) {
      stack.pop();
      continue;
    }
    const slot = first[top.idx] + top.k++;
    // SFST writes the label's analysis symbol first and its surface symbol second ("lower" and
    // "upper" in SFST's own words); here lower = surface (what is read), upper = analysis (output)
    upper[slot] = buf.readUInt16LE(p);
    lower[slot] = buf.readUInt16LE(p + 2);
    const t = buf.readUInt32LE(p + 4);
    p += 8;
    target[slot] = t;
    if (!seen[t]) {
      seen[t] = 1;
      stack.push(readInfo(t));
    }
  }
  first[nodes] = arcs;
  // the alphabet follows the nodes
  const utf8 = buf[p++] !== 0;
  if (!utf8) throw new Error("expected a UTF-8 alphabet");
  const nsym = buf.readUInt16LE(p);
  p += 2;
  const symbols = {};
  for (let i = 0; i < nsym; i++) {
    const code = buf.readUInt16LE(p);
    p += 2;
    const end = buf.indexOf(0, p);
    symbols[code] = buf.toString("utf8", p, end);
    p = end + 1;
  }
  // sort each node's arcs by lower symbol (epsilon first) for a binary search at lookup
  for (let i = 0; i < nodes; i++) {
    const a = first[i];
    const n = count[i];
    if (n < 2) continue;
    const idx = Array.from({ length: n }, (_, k) => a + k).sort((x, y) => lower[x] - lower[y]);
    const t = idx.map((k) => target[k]);
    const l = idx.map((k) => lower[k]);
    const u = idx.map((k) => upper[k]);
    for (let k = 0; k < n; k++) {
      target[a + k] = t[k];
      lower[a + k] = l[k];
      upper[a + k] = u[k];
    }
  }
  return { nodes, arcs, final, first, target: target.subarray(0, arcs), lower: lower.subarray(0, arcs), upper: upper.subarray(0, arcs), symbols };
}

function layout(fst) {
  const sym = Buffer.from(JSON.stringify(fst.symbols), "utf8");
  const pad = (n) => (4 - (n % 4)) % 4;
  const headLen = 16 + sym.length;
  const parts = [];
  const head = Buffer.alloc(16);
  head.write("LMF1", 0, "ascii");
  head.writeUInt32LE(fst.nodes, 4);
  head.writeUInt32LE(fst.arcs, 8);
  head.writeUInt32LE(sym.length, 12);
  parts.push(head, sym, Buffer.alloc(pad(headLen)));
  parts.push(Buffer.from(fst.final.buffer, 0, fst.nodes), Buffer.alloc(pad(fst.nodes)));
  parts.push(Buffer.from(fst.first.buffer, fst.first.byteOffset, fst.first.byteLength));
  parts.push(Buffer.from(fst.target.buffer, fst.target.byteOffset, fst.target.byteLength));
  parts.push(Buffer.from(fst.lower.buffer, fst.lower.byteOffset, fst.lower.byteLength));
  parts.push(Buffer.from(fst.upper.buffer, fst.upper.byteOffset, fst.upper.byteLength));
  return Buffer.concat(parts);
}

function mistakes(csv) {
  const out = {};
  const lines = csv.toString("utf8").split(/\r?\n/).slice(1);
  for (const line of lines) {
    // a few corrections carry a stray zero-width joiner at the end
    const [word, correct] = line.split(",").map((s) => s?.replace(/[\u200c\u200d\s]+$/u, "").trim());
    if (word && correct && word !== correct) out[word] = correct;
  }
  return out;
}

const whl = await wheel();
const fst = readSfst(unzip(whl, "mlmorph/data/malayalam.a"));
const bin = layout(fst);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "mlmorph.bin.gz"), gzipSync(bin, { level: 9 }));
writeFileSync(join(OUT, "mistakes.json"), JSON.stringify(mistakes(unzip(whl, "mlmorph/spellchecker/resources/common_mistakes.csv"))));
writeFileSync(join(OUT, "VERSION"), `mlmorph ${VERSION} (MIT licence, Swathanthra Malayalam Computing)\n`);
console.log(`mlmorph ${VERSION}: ${fst.nodes} states, ${fst.arcs} arcs, ${Object.keys(fst.symbols).length} symbols → ${(bin.length / 1e6).toFixed(1)} MB, gzip ${(gzipSync(bin, { level: 9 }).length / 1e6).toFixed(1)} MB`);
if (!existsSync(join(OUT, "mlmorph.bin.gz"))) process.exit(1);
