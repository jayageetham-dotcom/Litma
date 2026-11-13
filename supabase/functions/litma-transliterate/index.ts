// GET /functions/v1/litma-transliterate?text=nammude&num=6  →  { candidates: [...], source }
import { cors, json, preflight } from "../_shared/cors.ts";
import { googleCandidates } from "../_shared/google.ts";
import { hit, ipKey, tooMany } from "../_shared/ratelimit.ts";

// open to signed-out visitors (the home page demo), so each address gets a fair share: plenty for
// fast typing (one call per word typed), not enough to use Litma as a free relay to Google
const PER_MINUTE = 600;

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const wait = hit("translit", await ipKey(req), PER_MINUTE, 60);
  if (wait) return tooMany(wait);
  const url = new URL(req.url);
  const text = (url.searchParams.get("text") ?? "").slice(0, 64);
  const num = Math.min(Number(url.searchParams.get("num") ?? 6) || 6, 20);
  if (!text) return json({ candidates: [], source: "empty" });
  if (!/^[A-Za-z~_^]+$/.test(text)) return json({ candidates: [text], source: "passthrough" });
  const res = await googleCandidates(text, num);
  return json(res, 200, { "cache-control": "public, max-age=86400" });
});

export { cors };
