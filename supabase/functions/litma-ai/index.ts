// POST /functions/v1/litma-ai — streams plain text from Claude or GPT for the editor's AI panel.
// Requires a signed-in user (verify_jwt). Keys: the user's own key, or ANTHROPIC_API_KEY / OPENAI_API_KEY secrets.
import { cors, preflight } from "../_shared/cors.ts";
import { AI_ACTIONS, systemPrompt, userPrompt, type AIAction } from "../_shared/ai-prompts.ts";

interface Body {
  provider: "anthropic" | "openai";
  apiKey?: string;
  model?: string;
  action: AIAction;
  kind: string;
  selection?: string;
  context?: string;
  instruction?: string;
}

const text = (t: string, status = 400) => new Response(t, { status, headers: { ...cors, "content-type": "text/plain; charset=utf-8" } });

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
  if (!(b.action in AI_ACTIONS)) return text("Unknown action");
  const system = systemPrompt(b.kind);
  const prompt = userPrompt(b.action, b);
  const enc = new TextEncoder();
  const headers = { ...cors, "content-type": "text/plain; charset=utf-8" };

  if (b.provider === "openai") {
    const key = b.apiKey || Deno.env.get("OPENAI_API_KEY");
    if (!key) return text("Add an OpenAI API key in Settings → AI to use GPT.");
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: b.model || Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
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

  const key = b.apiKey || Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return text("Add an Anthropic API key in Settings → AI to use Claude.");
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: b.model || Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5",
      max_tokens: 2000,
      stream: true,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
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
