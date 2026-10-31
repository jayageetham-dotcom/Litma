/**
 * Litma MCP server — Streamable HTTP transport, stateless JSON responses.
 *
 * Public URL:  https://www.jayageetham.com/litma/mcp   (PHP proxy → this function)
 * Direct URL:  https://<ref>.supabase.co/functions/v1/litma-mcp
 *
 * Auth: "Authorization: Bearer litma_…" (create a token in Litma → Settings → MCP),
 * or "?key=litma_…" for clients that cannot send headers.
 * Deployed with verify_jwt = false because it authenticates Litma tokens itself.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { cors, json, preflight } from "../_shared/cors.ts";
import { textToNodes, toMarkdown, toPlainText, type JSONContent } from "../_shared/serialize.ts";
import { WRITING_GUIDES } from "../_shared/guides.ts";
import { FORM_NAMES, KINDS, settingsFor, starterContent, type DocKind } from "../_shared/forms.ts";
import { transliteratePhrase } from "../_shared/google.ts";

const PROTOCOL = "2025-06-18";
const SITE = (Deno.env.get("LITMA_SITE_URL") ?? "https://www.jayageetham.com/litma").replace(/\/$/, "");
const db: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const formName = (k: string) => FORM_NAMES[k as DocKind] ?? FORM_NAMES.blank;
const words = (t: string) => (t.match(/\S+/g) ?? []).length;

const TOOLS = [
  {
    name: "list_documents",
    title: "List documents",
    description: "List the writer's Litma documents (novels, stories, poems, screenplays, features…) with id, title, form, word count and last edit time.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: KINDS, description: "Only this form" },
        limit: { type: "number", description: "Max results (default 30)" },
      },
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "search_documents",
    title: "Search documents",
    description: "Full-text search across the writer's documents (Malayalam or English). Returns matching documents with a snippet.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "read_document",
    title: "Read a document",
    description: "Read a document's full text. format 'markdown' (default) shows structure: titles, chapters, scenes and dialogue.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, format: { type: "string", enum: ["markdown", "text", "json"] } },
      required: ["id"],
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "get_writing_guide",
    title: "Writing guide",
    description: "Formatting conventions for a Litma form (e.g. the Malayalam screenplay layout). Read before writing text for a document.",
    inputSchema: { type: "object", properties: { kind: { type: "string", enum: KINDS } }, required: ["kind"] },
    annotations: { readOnlyHint: true },
  },
  {
    name: "suggest_edit",
    title: "Suggest an edit",
    description:
      "Send a suggestion to the writer's Litma inbox; they review it in the editor. Prefer this over editing directly. kind 'insert' adds text at the cursor, 'replace' swaps target_text for content, 'comment' is an editorial note.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Document id" },
        content: { type: "string", description: "Suggested text (Malayalam Unicode) or the note" },
        kind: { type: "string", enum: ["insert", "replace", "comment"] },
        target_text: { type: "string", description: "Exact existing text to replace (kind='replace')" },
        note: { type: "string", description: "Why you suggest this (shown to the writer)" },
        source: { type: "string", description: "Your name, e.g. 'Claude', 'ChatGPT', 'Bob'" },
      },
      required: ["id", "content"],
    },
  },
  {
    name: "append_to_document",
    title: "Append text",
    description:
      "Append text to the end of a document. Parsed by form: '# ' title, '## ' chapter, blank-line paragraphs; screenplay lines like 'Scene: Int./Beach' and 'പേര്: സംഭാഷണം'.",
    inputSchema: { type: "object", properties: { id: { type: "string" }, text: { type: "string" } }, required: ["id", "text"] },
  },
  {
    name: "create_document",
    title: "Create a document",
    description: "Create a new Litma document of a given form, optionally with starting text.",
    inputSchema: {
      type: "object",
      properties: { title: { type: "string" }, kind: { type: "string", enum: KINDS }, text: { type: "string" } },
      required: ["title", "kind"],
    },
  },
  {
    name: "transliterate",
    title: "Manglish → Malayalam",
    description: "Convert Manglish (romanised Malayalam, e.g. 'ente naadu') into Malayalam script using Google Input Tools with an offline fallback.",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    annotations: { readOnlyHint: true },
  },
];

type Json = Record<string, unknown>;
const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const text = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], isError });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const token = header.replace(/^Bearer\s+/i, "") || url.searchParams.get("key") || "";
  if (!token.startsWith("litma_")) return null;
  const { data } = await db.from("mcp_tokens").select("id,user_id").eq("token_hash", await sha256(token)).maybeSingle();
  if (!data) return null;
  db.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return data.user_id as string;
}

async function callTool(name: string, args: Json, userId: string) {
  switch (name) {
    case "list_documents": {
      let q = db
        .from("documents")
        .select("id,title,kind,word_count,updated_at")
        .eq("user_id", userId)
        .eq("archived", false)
        .order("updated_at", { ascending: false })
        .limit(Number(args.limit) || 30);
      if (args.kind) q = q.eq("kind", String(args.kind));
      const { data, error } = await q;
      if (error) return text(error.message, true);
      if (!data?.length) return text("No documents yet.");
      return text(data.map((d) => `- ${d.title} [${formName(d.kind).en}] — ${d.word_count} words — updated ${d.updated_at} — id: ${d.id}`).join("\n"));
    }
    case "search_documents": {
      const qs = String(args.query ?? "").trim().replace(/[%,()*]/g, " ");
      if (!qs) return text("Provide a query.", true);
      const { data, error } = await db
        .from("documents")
        .select("id,title,kind,plain_text")
        .eq("user_id", userId)
        .eq("archived", false)
        .or(`title.ilike.%${qs}%,plain_text.ilike.%${qs}%`)
        .limit(20);
      if (error) return text(error.message, true);
      if (!data?.length) return text(`Nothing matches “${qs}”.`);
      return text(
        data
          .map((d) => {
            const pt = d.plain_text as string;
            const i = pt.indexOf(qs);
            const snip = i >= 0 ? pt.slice(Math.max(0, i - 80), i + 120).replace(/\s+/g, " ") : "";
            return `- ${d.title} [${d.kind}] id: ${d.id}${snip ? `\n  …${snip}…` : ""}`;
          })
          .join("\n")
      );
    }
    case "read_document": {
      const { data, error } = await db.from("documents").select("id,title,kind,content,word_count,settings").eq("user_id", userId).eq("id", String(args.id)).maybeSingle();
      if (error || !data) return text("Document not found.", true);
      const fmt = String(args.format ?? "markdown");
      const content = data.content as JSONContent;
      const body = fmt === "json" ? JSON.stringify(content) : fmt === "text" ? toPlainText(content) : toMarkdown(content);
      const notes = (data.settings as Json)?.notes ? `\n\n---\nWriter's notes:\n${(data.settings as Json).notes}` : "";
      const f = formName(data.kind);
      return text(`# ${data.title}\nForm: ${f.en} (${f.ml}) · ${data.word_count} words · edit: ${SITE}/write/?id=${data.id}\n\n${body}${notes}`);
    }
    case "get_writing_guide":
      return text(WRITING_GUIDES[String(args.kind)] ?? WRITING_GUIDES.blank);
    case "suggest_edit": {
      const { data: doc } = await db.from("documents").select("id").eq("user_id", userId).eq("id", String(args.id)).maybeSingle();
      if (!doc) return text("Document not found.", true);
      const kind = ["insert", "replace", "comment"].includes(String(args.kind)) ? String(args.kind) : args.target_text ? "replace" : "insert";
      const { error } = await db.from("suggestions").insert({
        document_id: doc.id,
        user_id: userId,
        source: String(args.source ?? "Assistant").slice(0, 40),
        kind,
        content: String(args.content),
        target_text: args.target_text ? String(args.target_text) : null,
        note: args.note ? String(args.note) : null,
      });
      if (error) return text(error.message, true);
      return text("Suggestion sent. The writer sees it live in Litma's Inbox and can accept or dismiss it.");
    }
    case "append_to_document": {
      const { data, error } = await db.from("documents").select("id,kind,content,settings").eq("user_id", userId).eq("id", String(args.id)).maybeSingle();
      if (error || !data) return text("Document not found.", true);
      const content = data.content as JSONContent;
      const nodes = textToNodes(String(args.text ?? ""), data.kind);
      const next = { ...content, content: [...(content.content ?? []), ...nodes] };
      const plain = toPlainText(next);
      const settings = { ...(data.settings as Json), pristine: false };
      const { error: e2 } = await db.from("documents").update({ content: next, plain_text: plain, word_count: words(plain), settings }).eq("id", data.id);
      if (e2) return text(e2.message, true);
      return text(`Appended ${nodes.length} block(s); the document now has ${words(plain)} words. If it is open in Litma, reload to see it.`);
    }
    case "create_document": {
      const kind = (KINDS.includes(String(args.kind) as DocKind) ? String(args.kind) : "blank") as DocKind;
      const title = String(args.title || `പുതിയ ${formName(kind).ml}`);
      const content: JSONContent = args.text
        ? { type: "doc", content: [{ type: "styledBlock", attrs: { variant: "title" }, content: [{ type: "text", text: title }] }, ...textToNodes(String(args.text), kind)] }
        : starterContent(kind);
      const plain = toPlainText(content);
      const { data, error } = await db
        .from("documents")
        .insert({ user_id: userId, title, kind, content, settings: settingsFor(kind), plain_text: plain, word_count: words(plain) })
        .select("id")
        .single();
      if (error) return text(error.message, true);
      return text(`Created “${title}” (${formName(kind).en}). id: ${data.id}\nOpen: ${SITE}/write/?id=${data.id}`);
    }
    case "transliterate":
      return text(await transliteratePhrase(String(args.text ?? "")));
    default:
      return text(`Unknown tool: ${name}`, true);
  }
}

async function handle(msg: Json, userId: string | null) {
  const { id, method, params } = msg as { id?: unknown; method: string; params?: Json };
  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: (params?.protocolVersion as string) || PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "litma", title: "Litma — Malayalam writing desk", version: "0.2.0" },
        instructions:
          "Litma holds the writer's Malayalam literary work. Read before suggesting. Write in Malayalam Unicode, never Manglish. Prefer suggest_edit so the writer stays in control; call get_writing_guide before writing for a form.",
      });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call":
      if (!userId) return ok(id, text("Not authorised. Create a token in Litma → Settings → MCP and send it as a Bearer token.", true));
      try {
        return ok(id, await callTool(String(params?.name), (params?.arguments as Json) ?? {}, userId));
      } catch (e) {
        return ok(id, text(e instanceof Error ? e.message : "Tool failed", true));
      }
    case "resources/list":
      return ok(id, { resources: [] });
    case "prompts/list":
      return ok(id, { prompts: [] });
    default:
      if (id === undefined) return null; // notification
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method === "GET") return new Response("Litma MCP endpoint. POST JSON-RPC here.", { status: 405, headers: { ...cors, Allow: "POST" } });
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: cors });

  let body: Json | Json[];
  try {
    body = await req.json();
  } catch {
    return json(fail(null, -32700, "Parse error"), 400);
  }
  const msgs = Array.isArray(body) ? body : [body];
  const userId = await authenticate(req);
  if (msgs.some((m) => m.method === "tools/call") && !userId) {
    return json(fail((msgs[0] as Json).id ?? null, -32001, "Unauthorized: missing or invalid Litma token"), 401, { "WWW-Authenticate": 'Bearer realm="litma"' });
  }
  const results = (await Promise.all(msgs.map((m) => handle(m, userId)))).filter(Boolean);
  if (!results.length) return new Response(null, { status: 202, headers: cors });
  return json(Array.isArray(body) ? results : results[0], 200, { "Mcp-Protocol-Version": PROTOCOL });
});
