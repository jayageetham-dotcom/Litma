/**
 * POST /functions/v1/litma-ai — the editor's AI companion. Requires a signed-in user.
 *
 * Every writer uses their OWN provider key:
 *   { op: "keys" }                                   → [{ provider, last4, model, updated_at }]
 *   { op: "set_key", provider, key, model? }         → stores the key AES-GCM-encrypted
 *   { op: "delete_key", provider }
 *   { op: "chat", provider, action, kind, selection?, context?, instruction?, model? } → streamed text
 * Keys are never sent back to the browser.
 */
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { cors, preflight } from "../_shared/cors.ts";
import { AI_ACTIONS, systemPrompt, userPrompt, type AIAction } from "../_shared/ai-prompts.ts";
import { recordUsage } from "../_shared/usage.ts";

type Provider = "anthropic" | "openai" | "gemini";
const PROVIDERS: Provider[] = ["anthropic", "openai", "gemini"];
const DEFAULT_MODEL: Record<Provider, string> = {
  anthropic: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
  openai: Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini",
  gemini: Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash",
};

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const text = (t: string, status = 400) => new Response(t, { status, headers: { ...cors, "content-type": "text/plain; charset=utf-8" } });
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

// ── encryption (AES-GCM, key derived from a server-only secret) ──
let aesKey: Promise<CryptoKey> | null = null;
function key() {
  aesKey ??= (async () => {
    const secret = Deno.env.get("LITMA_KEYS_SECRET") ?? `${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}:litma-ai-keys`;
    const raw = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
    return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  })();
  return aesKey;
}
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function encrypt(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(), new TextEncoder().encode(plain)));
  return { ciphertext: b64(ct), iv: b64(iv) };
}
async function decrypt(ciphertext: string, iv: string) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await key(), unb64(ciphertext));
  return new TextDecoder().decode(pt);
}

async function userId(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  const client = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

async function storedKey(uid: string, provider: Provider): Promise<{ key: string; model: string | null } | null> {
  const { data } = await admin.from("ai_keys").select("ciphertext,iv,model").eq("user_id", uid).eq("provider", provider).maybeSingle();
  if (!data) return null;
  try {
    return { key: await decrypt(data.ciphertext, data.iv), model: data.model };
  } catch {
    return null; // server secret changed — the writer re-enters the key
  }
}

interface Body {
  op?: "chat" | "keys" | "set_key" | "delete_key";
  provider?: Provider;
  key?: string;
  apiKey?: string;
  model?: string;
  action?: AIAction;
  kind?: string;
  selection?: string;
  context?: string;
  instruction?: string;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return text("POST only", 405);
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return text("Invalid JSON");
  }
  const uid = await userId(req);
  if (!uid) return text("Sign in to use the AI companion.", 401);
  const op = b.op ?? "chat";

  if (op === "keys") {
    const { data } = await admin.from("ai_keys").select("provider,last4,model,updated_at").eq("user_id", uid);
    return json(data ?? []);
  }
  if (op === "set_key") {
    if (!b.provider || !PROVIDERS.includes(b.provider)) return text("Unknown provider");
    const k = (b.key ?? "").trim();
    if (k.length < 12) return text("That doesn't look like an API key.");
    const enc = await encrypt(k);
    const { error } = await admin
      .from("ai_keys")
      .upsert({ user_id: uid, provider: b.provider, ...enc, last4: k.slice(-4), model: b.model?.trim() || null, updated_at: new Date().toISOString() });
    if (error) return text(error.message, 500);
    return json({ ok: true, provider: b.provider, last4: k.slice(-4) });
  }
  if (op === "delete_key") {
    await admin.from("ai_keys").delete().eq("user_id", uid).eq("provider", b.provider ?? "");
    return json({ ok: true });
  }

  // ── chat ──
  const provider = (PROVIDERS.includes(b.provider as Provider) ? b.provider : "anthropic") as Provider;
  if (!b.action || !(b.action in AI_ACTIONS)) return text("Unknown action");
  const stored = await storedKey(uid, provider);
  const envKey = { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", gemini: "GEMINI_API_KEY" }[provider];
  const apiKey = b.apiKey || stored?.key || Deno.env.get(envKey);
  const names = { anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT)", gemini: "Google (Gemini)" };
  if (!apiKey) return text(`Add your ${names[provider]} API key in Settings → AI to use it.`);
  const model = b.model || stored?.model || DEFAULT_MODEL[provider];
  recordUsage(admin, uid, "ai_request", b.action, { provider });
  const system = systemPrompt(b.kind ?? "blank");
  const prompt = userPrompt(b.action, b);
  const enc = new TextEncoder();
  const headers = { ...cors, "content-type": "text/plain; charset=utf-8" };

  if (provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!r.ok || !r.body) return text(`OpenAI error ${r.status}: ${await r.text()}`, 502);
    return new Response(sse(r.body, (j) => j?.choices?.[0]?.delta?.content ?? "", enc), { headers });
  }

  if (provider === "gemini") {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    });
    if (!r.ok || !r.body) return text(`Gemini error ${r.status}: ${await r.text()}`, 502);
    return new Response(
      sse(r.body, (j) => (j?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join(""), enc),
      { headers }
    );
  }

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 2000, stream: true, system, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok || !r.body) return text(`Claude error ${r.status}: ${await r.text()}`, 502);
  return new Response(sse(r.body, (j) => (j?.type === "content_block_delta" ? j.delta?.text ?? "" : ""), enc), { headers });
});

// deno-lint-ignore no-explicit-any
function sse(body: ReadableStream<Uint8Array>, pick: (j: any) => string, enc: TextEncoder) {
  const dec = new TextDecoder();
  let buf = "";
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const out = pick(JSON.parse(data));
          if (out) controller.enqueue(enc.encode(out));
        } catch {
          /* partial event */
        }
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
