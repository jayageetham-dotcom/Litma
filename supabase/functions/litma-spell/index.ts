/**
 * POST /functions/v1/litma-spell — Litma's Malayalam spelling engine. Requires a signed-in user.
 *
 *   { words: string[] }  →  { verdicts: { [word]: { k: "ok" | "mistake" | "suspect" | "unknown", fix?: string[] } } }
 *
 * Built on Swathanthra Malayalam Computing's mlmorph (MIT licence): a morphology that knows how
 * Malayalam words are inflected and joined, its list of common misspellings, its foreign-word
 * detector and its suggestion strategies (_shared/mlmorph.ts). The data (data/mlmorph.bin.gz,
 * data/mistakes.json) is made by scripts/build-mlmorph.mjs in the deploy job and shipped with the
 * function (static_files in supabase/config.toml); it loads once per instance (about 0.1 s).
 * Nothing is stored: the words are checked and forgotten.
 */
import { cors, preflight } from "../_shared/cors.ts";
import { MlMorph, MlSpeller } from "../_shared/mlmorph.ts";

const MAX_WORDS = 1000;
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

async function readData(name: string): Promise<Uint8Array> {
  // static files sit beside the function; try the module-relative path first, then the working directory
  for (const path of [new URL(`./data/${name}`, import.meta.url), `./data/${name}`, `./litma-spell/data/${name}`]) {
    try {
      return await Deno.readFile(path);
    } catch {
      /* next */
    }
  }
  throw new Error(`litma-spell: ${name} is missing (run scripts/build-mlmorph.mjs before deploying)`);
}

let speller: Promise<MlSpeller> | null = null;
function engine() {
  speller ??= (async () => {
    const gz = await readData("mlmorph.bin.gz");
    const raw = new Uint8Array(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
    const mistakes = JSON.parse(new TextDecoder().decode(await readData("mistakes.json"))) as Record<string, string>;
    return new MlSpeller(new MlMorph(raw), mistakes);
  })().catch((e) => {
    speller = null; // try again on the next request
    throw e;
  });
  return speller;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let words: unknown;
  try {
    words = (await req.json())?.words;
  } catch {
    return json({ error: "Send JSON: { words: [...] }" }, 400);
  }
  if (!Array.isArray(words)) return json({ error: "words must be a list" }, 400);
  const list = [...new Set(words.filter((w): w is string => typeof w === "string" && w.length > 0 && w.length <= 60 && /[ഀ-ൿ]/.test(w)))].slice(0, MAX_WORDS);
  let sp: MlSpeller;
  try {
    sp = await engine();
  } catch (e) {
    console.error(e);
    return json({ error: "The spelling engine isn't available." }, 503);
  }
  const verdicts: Record<string, { k: string; fix?: string[] }> = {};
  for (const w of list) {
    const v = sp.check(w);
    verdicts[w] = v.ok ? { k: "ok" } : v.fix.length ? { k: v.kind, fix: v.fix } : { k: v.kind };
  }
  return json({ verdicts });
});
