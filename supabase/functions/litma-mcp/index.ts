/**
 * Litma MCP server — Streamable HTTP transport, stateless JSON responses.
 *
 * Public URL:  https://getlitma.in/mcp   (PHP relay → this function)
 * Direct URL:  https://<ref>.supabase.co/functions/v1/litma-mcp
 *
 * Each writer connects their own AI assistant (any AI assistant that supports MCP (Claude, ChatGPT, Cursor, VS Code…))
 * with their own Litma token: "Authorization: Bearer litma_…" or "?key=litma_…".
 * Every tool is scoped to that writer's data. Deployed with verify_jwt = false.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";
import { cors, json, preflight } from "../_shared/cors.ts";
import { recordUsage } from "../_shared/usage.ts";
import { textToNodes, toMarkdown, toPlainText, type JSONContent } from "../_shared/serialize.ts";
import { WRITING_GUIDES } from "../_shared/guides.ts";
import { FORM_NAMES, KINDS, newSettings, starterContent, type DocKind } from "../_shared/forms.ts";
import { createDictionary } from "../_shared/dict.ts";
import { transliteratePhrase } from "../_shared/google.ts";

const PROTOCOL = "2025-06-18";
const SITE = (Deno.env.get("LITMA_SITE_URL") ?? "https://getlitma.in").replace(/\/$/, "");
/** the old address keeps serving the dictionary until getlitma.in is live (and redirects there afterwards) */
const LEGACY_SITE = "https://www.jayageetham.com/litma";
const db: SupabaseClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const dict = createDictionary((path) =>
  fetch(`${SITE}/dict/${path}.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .catch(() =>
      fetch(`${LEGACY_SITE}/dict/${path}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    )
);

type Json = Record<string, unknown>;
type Args = Record<string, any>; // deno-lint-ignore no-explicit-any
const formName = (k: string) => FORM_NAMES[k as DocKind] ?? FORM_NAMES.blank;
const words = (t: string) => (t.match(/\S+/g) ?? []).length;
const uid = () => crypto.randomUUID().slice(0, 8);
const out = (t: string, isError = false) => ({ content: [{ type: "text", text: t }], isError });
const outJson = (v: unknown) => out(JSON.stringify(v, null, 2));
const S = (type: string, description: string, extra: Json = {}) => ({ type, description, ...extra });
const STORY_KINDS = ["character", "location", "item", "beat", "event", "note"];
const BOOK_ITEM_TYPES = ["half-title", "title", "copyright", "dedication", "epigraph", "toc", "text", "part", "document", "cover", "back-cover"];

async function ownDoc(userId: string, id: unknown, cols = "id,title,kind,content,settings,word_count,archived") {
  const { data } = await db.from("documents").select(cols).eq("user_id", userId).eq("id", String(id ?? "")).maybeSingle();
  return data as Json | null;
}
async function ownBook(userId: string, id: unknown) {
  const { data } = await db.from("books").select("*").eq("user_id", userId).eq("id", String(id ?? "")).maybeSingle();
  return data as Json | null;
}
async function saveContent(id: string, content: JSONContent, settings?: Json) {
  const plain = toPlainText(content);
  const patch: Json = { content, plain_text: plain.slice(0, 200000), word_count: words(plain) };
  if (settings) patch.settings = { ...settings, pristine: false };
  const { error } = await db.from("documents").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return words(plain);
}
const docLink = (id: string) => `${SITE}/write/?id=${id}`;
const bookLink = (id: string) => `${SITE}/book/?id=${id}`;

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  annotations?: Json;
  run: (a: Args, userId: string) => Promise<ReturnType<typeof out>>;
}

const RO = { readOnlyHint: true };
const DESTRUCTIVE = { destructiveHint: true };

const TOOLS: Tool[] = [
  // ── Documents ──────────────────────────────────────────────────────────
  {
    name: "list_documents",
    title: "List documents",
    description: "List the writer's works (novels, stories, poems, screenplays, features…) with id, title, writing type (സാഹിത്യരൂപം), words and last edit. Set trash=true for deleted works.",
    inputSchema: { type: "object", properties: { kind: S("string", "Only this writing type", { enum: KINDS }), trash: S("boolean", "List the trash instead"), limit: S("number", "Max results (default 50)") } },
    annotations: RO,
    async run(a, u) {
      let q = db.from("documents").select("id,title,kind,word_count,updated_at").eq("user_id", u).eq("archived", !!a.trash).order("updated_at", { ascending: false }).limit(Number(a.limit) || 50);
      if (a.kind) q = q.eq("kind", String(a.kind));
      const { data, error } = await q;
      if (error) return out(error.message, true);
      if (!data?.length) return out(a.trash ? "The trash is empty." : "No documents yet.");
      return out(data.map((d) => `- ${d.title} [${formName(d.kind).en}] — ${d.word_count} words — updated ${d.updated_at} — id: ${d.id}`).join("\n"));
    },
  },
  {
    name: "search_documents",
    title: "Search documents",
    description: "Full-text search across the writer's works (Malayalam or English). Returns matches with a snippet.",
    inputSchema: { type: "object", properties: { query: S("string", "Words to find") }, required: ["query"] },
    annotations: RO,
    async run(a, u) {
      const qs = String(a.query ?? "").trim().replace(/[%,()*]/g, " ");
      if (!qs) return out("Provide a query.", true);
      const { data, error } = await db.from("documents").select("id,title,kind,plain_text").eq("user_id", u).eq("archived", false).or(`title.ilike.%${qs}%,plain_text.ilike.%${qs}%`).limit(20);
      if (error) return out(error.message, true);
      if (!data?.length) return out(`Nothing matches “${qs}”.`);
      return out(
        data
          .map((d) => {
            const pt = d.plain_text as string;
            const i = pt.indexOf(qs);
            const snip = i >= 0 ? pt.slice(Math.max(0, i - 80), i + 120).replace(/\s+/g, " ") : "";
            return `- ${d.title} [${d.kind}] id: ${d.id}${snip ? `\n  …${snip}…` : ""}`;
          })
          .join("\n")
      );
    },
  },
  {
    name: "read_document",
    title: "Read a document",
    description: "Read a work's full text. format 'markdown' (default) shows structure — titles, chapters, scenes, dialogue; 'text' is plain; 'json' is the raw editor document.",
    inputSchema: { type: "object", properties: { id: S("string", "Document id"), format: S("string", "Output format", { enum: ["markdown", "text", "json"] }) }, required: ["id"] },
    annotations: RO,
    async run(a, u) {
      const d = await ownDoc(u, a.id);
      if (!d) return out("Document not found.", true);
      const c = d.content as JSONContent;
      const fmt = String(a.format ?? "markdown");
      const st = d.settings as Json;
      const opts = { kind: String(d.kind), labels: st?.headingLabels === "en" || st?.headingLabels === "ml" ? (st.headingLabels as "en" | "ml") : undefined };
      const body = fmt === "json" ? JSON.stringify(c) : fmt === "text" ? toPlainText(c, opts) : toMarkdown(c, opts);
      const notes = st?.notes ? `\n\n---\nWriter's notes:\n${st.notes}` : "";
      const f = formName(String(d.kind));
      return out(`# ${d.title}\nWriting type (സാഹിത്യരൂപം): ${f.en} (${f.ml}) · ${d.word_count} words · edit: ${docLink(String(d.id))}\n\n${body}${notes}`);
    },
  },
  {
    name: "create_document",
    title: "Create a document",
    description: "Create a new work of a given writing type, optionally with starting text (parsed like append_to_document).",
    inputSchema: { type: "object", properties: { title: S("string", "Title"), kind: S("string", "Writing type", { enum: KINDS }), text: S("string", "Optional starting text") }, required: ["title", "kind"] },
    async run(a, u) {
      const kind = (KINDS.includes(a.kind) ? a.kind : "blank") as DocKind;
      const title = String(a.title || `പുതിയ ${formName(kind).ml}`);
      const content: JSONContent = a.text
        ? { type: "doc", content: [{ type: "styledBlock", attrs: { variant: "title" }, content: [{ type: "text", text: title }] }, ...textToNodes(String(a.text), kind)] }
        : starterContent(kind);
      const plain = toPlainText(content);
      const { data, error } = await db
        .from("documents")
        .insert({ user_id: u, title, kind, content, settings: { ...newSettings(kind), pristine: !a.text }, plain_text: plain, word_count: words(plain) })
        .select("id")
        .single();
      if (error) return out(error.message, true);
      return out(`Created “${title}” (${formName(kind).en}). id: ${data.id}\nOpen: ${docLink(data.id)}`);
    },
  },
  {
    name: "append_to_document",
    title: "Append text",
    description:
      "Add text to the end of a work. Parsed by writing type: '# ' title, '## ' chapter, '### ' subhead, blank-line paragraphs, '* * *' scene break; screenplay lines like 'Scene: Int./Beach' and 'പേര്: സംഭാഷണം'; drama '(stage direction)'. Call get_writing_guide first.",
    inputSchema: { type: "object", properties: { id: S("string", "Document id"), text: S("string", "Text to add") }, required: ["id", "text"] },
    async run(a, u) {
      const d = await ownDoc(u, a.id);
      if (!d) return out("Document not found.", true);
      const c = d.content as JSONContent;
      const nodes = textToNodes(String(a.text ?? ""), String(d.kind));
      const n = await saveContent(String(d.id), { ...c, content: [...(c.content ?? []), ...nodes] }, d.settings as Json);
      return out(`Appended ${nodes.length} block(s); now ${n} words. If it's open in Litma, reload to see it.`);
    },
  },
  {
    name: "replace_text",
    title: "Find and replace",
    description: "Replace exact text in a work (within paragraphs). Use for precise edits the writer asked for; prefer suggest_edit for proposals.",
    inputSchema: {
      type: "object",
      properties: { id: S("string", "Document id"), find: S("string", "Exact text to find"), replace: S("string", "Replacement"), all: S("boolean", "Replace every occurrence (default: first only)") },
      required: ["id", "find", "replace"],
    },
    async run(a, u) {
      const d = await ownDoc(u, a.id);
      if (!d) return out("Document not found.", true);
      const find = String(a.find);
      if (!find) return out("Nothing to find.", true);
      let count = 0;
      const walk = (n: JSONContent): JSONContent => {
        if (n.type === "text" && n.text && (a.all || count === 0) && n.text.includes(find)) {
          if (a.all) {
            count += n.text.split(find).length - 1;
            return { ...n, text: n.text.split(find).join(String(a.replace)) };
          }
          count = 1;
          return { ...n, text: n.text.replace(find, String(a.replace)) };
        }
        return n.content ? { ...n, content: n.content.map(walk) } : n;
      };
      const next = walk(d.content as JSONContent);
      if (!count) return out(`“${find}” wasn't found (text split across formatting can't be matched).`, true);
      await saveContent(String(d.id), next, d.settings as Json);
      return out(`Replaced ${count} occurrence(s).`);
    },
  },
  {
    name: "update_document",
    title: "Rename or restyle a document",
    description: "Change a work's title, page size, font, size, line spacing, margins, word goal or notes.",
    inputSchema: {
      type: "object",
      properties: {
        id: S("string", "Document id"),
        title: S("string", "New title"),
        pageSize: S("string", "Paper", { enum: ["A4", "A5", "Letter", "Legal"] }),
        font: S("string", "e.g. Noto Serif Malayalam, Manjari, Gayathri"),
        fontSize: S("number", "Points"),
        lineHeight: S("number", "e.g. 1.8"),
        margins: S("object", "mm: {top,bottom,left,right}"),
        goal: S("number", "Word goal"),
        notes: S("string", "Replace the writer's notes"),
      },
      required: ["id"],
    },
    async run(a, u) {
      const d = await ownDoc(u, a.id, "id,settings");
      if (!d) return out("Document not found.", true);
      const st = { ...(d.settings as Json) };
      for (const k of ["pageSize", "font", "fontSize", "lineHeight", "margins", "goal", "notes"]) if (a[k] !== undefined) st[k] = a[k];
      const patch: Json = { settings: st };
      if (a.title) patch.title = String(a.title);
      const { error } = await db.from("documents").update(patch).eq("id", String(d.id));
      return error ? out(error.message, true) : out("Updated.");
    },
  },
  {
    name: "trash_document",
    title: "Move to trash / restore",
    description: "Move a work to the trash (restorable), or restore it with restore=true.",
    inputSchema: { type: "object", properties: { id: S("string", "Document id"), restore: S("boolean", "Restore from trash") }, required: ["id"] },
    annotations: DESTRUCTIVE,
    async run(a, u) {
      const d = await ownDoc(u, a.id, "id,title");
      if (!d) return out("Document not found.", true);
      await db.from("documents").update({ archived: !a.restore }).eq("id", String(d.id));
      return out(a.restore ? `Restored “${d.title}”.` : `Moved “${d.title}” to the trash.`);
    },
  },
  {
    name: "list_versions",
    title: "Version history",
    description: "List saved versions of a work.",
    inputSchema: { type: "object", properties: { id: S("string", "Document id") }, required: ["id"] },
    annotations: RO,
    async run(a, u) {
      const { data } = await db.from("document_versions").select("id,label,word_count,created_at").eq("user_id", u).eq("document_id", String(a.id)).order("created_at", { ascending: false }).limit(50);
      if (!data?.length) return out("No saved versions.");
      return out(data.map((v) => `- ${v.created_at}${v.label ? ` “${v.label}”` : ""} — ${v.word_count} words — version id: ${v.id}`).join("\n"));
    },
  },
  {
    name: "save_version",
    title: "Save a version",
    description: "Snapshot the current text as a named version (do this before large edits).",
    inputSchema: { type: "object", properties: { id: S("string", "Document id"), label: S("string", "Version name") }, required: ["id"] },
    async run(a, u) {
      const d = await ownDoc(u, a.id);
      if (!d) return out("Document not found.", true);
      const { error } = await db.from("document_versions").insert({ document_id: d.id, user_id: u, content: d.content, word_count: d.word_count, label: a.label ?? "Saved by assistant" });
      return error ? out(error.message, true) : out("Version saved.");
    },
  },
  {
    name: "restore_version",
    title: "Restore a version",
    description: "Replace a work's text with a saved version (the current text is saved as a version first).",
    inputSchema: { type: "object", properties: { id: S("string", "Document id"), version_id: S("string", "Version id from list_versions") }, required: ["id", "version_id"] },
    annotations: DESTRUCTIVE,
    async run(a, u) {
      const d = await ownDoc(u, a.id);
      if (!d) return out("Document not found.", true);
      const { data: v } = await db.from("document_versions").select("content").eq("user_id", u).eq("id", String(a.version_id)).maybeSingle();
      if (!v) return out("Version not found.", true);
      await db.from("document_versions").insert({ document_id: d.id, user_id: u, content: d.content, word_count: d.word_count, label: "Before restore (assistant)" });
      await saveContent(String(d.id), v.content as JSONContent, d.settings as Json);
      return out("Restored. The previous text was kept as a version.");
    },
  },

  // ── Inbox ──────────────────────────────────────────────────────────────
  {
    name: "suggest_edit",
    title: "Suggest an edit",
    description:
      "Send a suggestion to the writer's Litma inbox; they accept or dismiss it in the editor (it appears live). kind 'insert' adds text at the cursor, 'replace' swaps target_text for content, 'comment' is an editorial note. Prefer this for creative proposals.",
    inputSchema: {
      type: "object",
      properties: {
        id: S("string", "Document id"),
        content: S("string", "Suggested text (Malayalam Unicode) or the note"),
        kind: S("string", "Type", { enum: ["insert", "replace", "comment"] }),
        target_text: S("string", "Exact existing text to replace (kind='replace')"),
        note: S("string", "Why (shown to the writer)"),
        source: S("string", "Your name, e.g. 'Claude', 'ChatGPT'"),
      },
      required: ["id", "content"],
    },
    async run(a, u) {
      const d = await ownDoc(u, a.id, "id");
      if (!d) return out("Document not found.", true);
      const kind = ["insert", "replace", "comment"].includes(a.kind) ? a.kind : a.target_text ? "replace" : "insert";
      const { error } = await db.from("suggestions").insert({
        document_id: d.id,
        user_id: u,
        source: String(a.source ?? "Assistant").slice(0, 40),
        kind,
        content: String(a.content),
        target_text: a.target_text ? String(a.target_text) : null,
        note: a.note ? String(a.note) : null,
      });
      return error ? out(error.message, true) : out("Suggestion sent to the writer's inbox.");
    },
  },
  {
    name: "list_suggestions",
    title: "List inbox suggestions",
    description: "See suggestions for a work and whether the writer accepted or dismissed them.",
    inputSchema: { type: "object", properties: { id: S("string", "Document id") }, required: ["id"] },
    annotations: RO,
    async run(a, u) {
      const { data } = await db.from("suggestions").select("source,kind,content,status,created_at").eq("user_id", u).eq("document_id", String(a.id)).order("created_at", { ascending: false }).limit(50);
      if (!data?.length) return out("No suggestions.");
      return out(data.map((s) => `- [${s.status}] ${s.kind} from ${s.source}: ${String(s.content).slice(0, 160)}`).join("\n"));
    },
  },

  // ── Story World ───────────────────────────────────────────────────────
  {
    name: "list_story_items",
    title: "Story World: list",
    description: "Characters, locations, props/objects, plot beats, timeline events and notes for a work. Filter with kind.",
    inputSchema: { type: "object", properties: { id: S("string", "Document id"), kind: S("string", "Section", { enum: STORY_KINDS }) }, required: ["id"] },
    annotations: RO,
    async run(a, u) {
      let q = db.from("story_items").select("id,kind,name,summary,data").eq("user_id", u).eq("document_id", String(a.id)).order("kind").order("position");
      if (a.kind) q = q.eq("kind", String(a.kind));
      const { data, error } = await q;
      if (error) return out(error.message, true);
      if (!data?.length) return out("Story World is empty for this work.");
      return outJson(data);
    },
  },
  {
    name: "create_story_item",
    title: "Story World: add",
    description:
      "Add a character, location, item (prop/object), beat (plot card; data.group = act/chapter column, data.status, data.color), event (data.when/who/where) or note (data.link). Character data keys: role, age, gender, occupation, appearance, personality, backstory, goal, conflict, arc, relationships, voice. Location: setting (Int./Ext.), period, description, senses, significance.",
    inputSchema: {
      type: "object",
      properties: { id: S("string", "Document id"), kind: S("string", "Section", { enum: STORY_KINDS }), name: S("string", "Name/title"), summary: S("string", "One-line description"), data: S("object", "Extra fields (see description)") },
      required: ["id", "kind", "name"],
    },
    async run(a, u) {
      const d = await ownDoc(u, a.id, "id");
      if (!d) return out("Document not found.", true);
      if (!STORY_KINDS.includes(a.kind)) return out("Unknown kind.", true);
      const { data, error } = await db
        .from("story_items")
        .insert({ document_id: d.id, user_id: u, kind: a.kind, name: String(a.name), summary: String(a.summary ?? ""), data: a.data ?? {}, position: Date.now() % 1e9 })
        .select("id")
        .single();
      return error ? out(error.message, true) : out(`Added ${a.kind} “${a.name}”. id: ${data.id}`);
    },
  },
  {
    name: "update_story_item",
    title: "Story World: edit",
    description: "Change a Story World card's name, summary or fields (data is merged).",
    inputSchema: { type: "object", properties: { item_id: S("string", "Card id"), name: S("string", "Name"), summary: S("string", "Summary"), data: S("object", "Fields to set") }, required: ["item_id"] },
    async run(a, u) {
      const { data: it } = await db.from("story_items").select("id,data").eq("user_id", u).eq("id", String(a.item_id)).maybeSingle();
      if (!it) return out("Card not found.", true);
      const patch: Json = {};
      if (a.name !== undefined) patch.name = String(a.name);
      if (a.summary !== undefined) patch.summary = String(a.summary);
      if (a.data) patch.data = { ...(it.data as Json), ...a.data };
      const { error } = await db.from("story_items").update(patch).eq("id", it.id);
      return error ? out(error.message, true) : out("Updated.");
    },
  },
  {
    name: "delete_story_item",
    title: "Story World: delete",
    description: "Delete a Story World card.",
    inputSchema: { type: "object", properties: { item_id: S("string", "Card id") }, required: ["item_id"] },
    annotations: DESTRUCTIVE,
    async run(a, u) {
      const { error, count } = await db.from("story_items").delete({ count: "exact" }).eq("user_id", u).eq("id", String(a.item_id));
      return error ? out(error.message, true) : out(count ? "Deleted." : "Card not found.", !count);
    },
  },

  // ── Dictionary ────────────────────────────────────────────────────────
  {
    name: "dictionary_lookup",
    title: "Dictionary & thesaurus",
    description:
      "Look up a Malayalam or English word in Olam's open dictionaries: meanings (Malayalam–Malayalam, English–Malayalam), synonyms (പര്യായം), translations, and optionally opposites (വിപരീതം). Malayalam inflections are stemmed.",
    inputSchema: { type: "object", properties: { word: S("string", "Word (Malayalam or English)"), opposites: S("boolean", "Also find opposites (default true)") }, required: ["word"] },
    annotations: RO,
    async run(a) {
      const r = await dict.lookup(String(a.word ?? ""));
      if (!r.head) {
        const idx = await dict.index();
        return out(idx ? `“${a.word}” isn't in the dictionary.` : "Dictionary data isn't installed on the site yet.", !idx);
      }
      const opp = a.opposites === false ? [] : await dict.opposites(r);
      return outJson({ word: r.head, language: r.lang, meanings: r.meanings, synonyms: r.synonyms, translations: r.translations, opposites: opp });
    },
  },
  {
    name: "transliterate",
    title: "Manglish → Malayalam",
    description: "Convert Manglish (romanised Malayalam, e.g. 'ente naadu') into Malayalam script using Google Input Tools, with an offline fallback.",
    inputSchema: { type: "object", properties: { text: S("string", "Manglish text") }, required: ["text"] },
    annotations: RO,
    async run(a) {
      return out(await transliteratePhrase(String(a.text ?? "")));
    },
  },
  {
    name: "get_writing_guide",
    title: "Writing guide",
    description: "Formatting conventions for a Litma writing type (e.g. the Malayalam screenplay layout). Read before writing text into a work.",
    inputSchema: { type: "object", properties: { kind: S("string", "Writing type", { enum: KINDS }) }, required: ["kind"] },
    annotations: RO,
    async run(a) {
      return out(WRITING_GUIDES[String(a.kind)] ?? WRITING_GUIDES.blank);
    },
  },

  // ── Books ─────────────────────────────────────────────────────────────
  {
    name: "list_books",
    title: "List books",
    description: "The writer's books (collections of works with covers, front matter and a contents page).",
    inputSchema: { type: "object", properties: {} },
    annotations: RO,
    async run(_a, u) {
      const { data } = await db.from("books").select("id,title,author,structure,updated_at").eq("user_id", u).order("updated_at", { ascending: false });
      if (!data?.length) return out("No books yet.");
      return out(data.map((b) => `- ${b.title}${b.author ? ` — ${b.author}` : ""} — ${(b.structure as Json[]).filter((i) => i.type === "document").length} chapters — id: ${b.id}`).join("\n"));
    },
  },
  {
    name: "get_book",
    title: "Get a book",
    description: "A book's details, settings, cover and ordered contents (item ids, types, chapter document ids and titles).",
    inputSchema: { type: "object", properties: { book_id: S("string", "Book id") }, required: ["book_id"] },
    annotations: RO,
    async run(a, u) {
      const b = await ownBook(u, a.book_id);
      if (!b) return out("Book not found.", true);
      const items = b.structure as Json[];
      const ids = items.filter((i) => i.type === "document").map((i) => i.documentId as string);
      const { data: docs } = ids.length ? await db.from("documents").select("id,title,kind,word_count").in("id", ids) : { data: [] };
      const byId = new Map((docs ?? []).map((d) => [d.id, d]));
      return outJson({
        id: b.id,
        title: b.title,
        subtitle: b.subtitle,
        author: b.author,
        settings: b.settings,
        cover: b.cover,
        contents: items.map((i) => ({ item_id: i.id, type: i.type, title: i.title ?? (i.type === "document" ? byId.get(i.documentId as string)?.title : undefined), documentId: i.documentId, words: i.type === "document" ? byId.get(i.documentId as string)?.word_count : undefined })),
        edit: bookLink(String(b.id)),
      });
    },
  },
  {
    name: "create_book",
    title: "Create a book",
    description: "Create a book with standard front matter (covers, half-title, title, copyright, contents) and optional chapters from documents (in order).",
    inputSchema: {
      type: "object",
      properties: { title: S("string", "Book title"), subtitle: S("string", "Subtitle"), author: S("string", "Author / pen name"), document_ids: S("array", "Documents to add as chapters, in order", { items: { type: "string" } }) },
      required: ["title"],
    },
    async run(a, u) {
      const chapters: Json[] = [];
      for (const id of (a.document_ids as string[]) ?? []) if (await ownDoc(u, id, "id")) chapters.push({ id: uid(), type: "document", documentId: id, showTitle: true });
      const structure = [
        { id: uid(), type: "cover" },
        { id: uid(), type: "half-title" },
        { id: uid(), type: "title" },
        { id: uid(), type: "copyright" },
        { id: uid(), type: "toc", title: "ഉള്ളടക്കം" },
        ...chapters,
        { id: uid(), type: "back-cover" },
      ];
      const { data, error } = await db
        .from("books")
        .insert({ user_id: u, title: String(a.title), subtitle: a.subtitle ?? null, author: a.author ?? null, structure, settings: { pageSize: "A4", chaptersOnRight: true, runningHead: true }, cover: { template: "kasavu" } })
        .select("id")
        .single();
      return error ? out(error.message, true) : out(`Created book “${a.title}” with ${chapters.length} chapter(s). id: ${data.id}\nOpen: ${bookLink(data.id)}`);
    },
  },
  {
    name: "update_book",
    title: "Edit book details, layout or cover",
    description:
      "Change title, subtitle, author; settings (pageSize A4/A5/Letter, font, fontSize, lineHeight, margins {top,bottom,inner,outer}, chaptersOnRight, runningHead, publisher, isbn, edition, year); cover (template kasavu|solid|photo|type|minimal, bg, fg, accent colours, font, titleScale, blurb, authorBio, price). Objects are merged.",
    inputSchema: {
      type: "object",
      properties: { book_id: S("string", "Book id"), title: S("string", "Title"), subtitle: S("string", "Subtitle"), author: S("string", "Author"), settings: S("object", "Layout & publishing fields"), cover: S("object", "Cover fields") },
      required: ["book_id"],
    },
    async run(a, u) {
      const b = await ownBook(u, a.book_id);
      if (!b) return out("Book not found.", true);
      const patch: Json = {};
      for (const k of ["title", "subtitle", "author"]) if (a[k] !== undefined) patch[k] = a[k];
      if (a.settings) patch.settings = { ...(b.settings as Json), ...a.settings };
      if (a.cover) patch.cover = { ...(b.cover as Json), ...a.cover };
      const { error } = await db.from("books").update(patch).eq("id", String(b.id));
      return error ? out(error.message, true) : out("Book updated.");
    },
  },
  {
    name: "add_to_book",
    title: "Add to a book",
    description:
      "Add an item: type 'document' (document_id) as a chapter, 'part' (title), 'text' page (title + text: preface, introduction, acknowledgements, about the author…), 'dedication'/'epigraph'/'copyright' (text), or 'toc'/'title'/'half-title'/'cover'/'back-cover'. Inserted before the back cover unless position (0-based) is given.",
    inputSchema: {
      type: "object",
      properties: {
        book_id: S("string", "Book id"),
        type: S("string", "Item type", { enum: BOOK_ITEM_TYPES }),
        document_id: S("string", "For type=document"),
        title: S("string", "Heading / chapter title override"),
        text: S("string", "Text for text/dedication/epigraph/copyright pages"),
        position: S("number", "0-based index in the contents"),
      },
      required: ["book_id", "type"],
    },
    async run(a, u) {
      const b = await ownBook(u, a.book_id);
      if (!b) return out("Book not found.", true);
      if (!BOOK_ITEM_TYPES.includes(a.type)) return out("Unknown item type.", true);
      if (a.type === "document" && !(await ownDoc(u, a.document_id, "id"))) return out("Document not found.", true);
      const item: Json = { id: uid(), type: a.type };
      if (a.document_id) item.documentId = String(a.document_id);
      if (a.title) item.title = String(a.title);
      if (a.type === "document") item.showTitle = true;
      if (a.text) item.content = { type: "doc", content: textToNodes(String(a.text), "blank") };
      const items = [...(b.structure as Json[])];
      const back = items.findIndex((i) => i.type === "back-cover");
      const at = typeof a.position === "number" ? Math.max(0, Math.min(items.length, a.position)) : back < 0 ? items.length : back;
      items.splice(at, 0, item);
      await db.from("books").update({ structure: items }).eq("id", String(b.id));
      return out(`Added ${a.type} at position ${at}. item id: ${item.id}`);
    },
  },
  {
    name: "remove_from_book",
    title: "Remove from a book",
    description: "Remove an item from a book's contents (documents themselves are not deleted).",
    inputSchema: { type: "object", properties: { book_id: S("string", "Book id"), item_id: S("string", "Item id from get_book") }, required: ["book_id", "item_id"] },
    async run(a, u) {
      const b = await ownBook(u, a.book_id);
      if (!b) return out("Book not found.", true);
      const items = (b.structure as Json[]).filter((i) => i.id !== a.item_id);
      if (items.length === (b.structure as Json[]).length) return out("Item not found.", true);
      await db.from("books").update({ structure: items }).eq("id", String(b.id));
      return out("Removed.");
    },
  },
  {
    name: "reorder_book",
    title: "Reorder a book",
    description: "Set the order of a book's contents by listing item ids (from get_book). Items you leave out keep their relative order at the end.",
    inputSchema: { type: "object", properties: { book_id: S("string", "Book id"), item_ids: S("array", "Item ids in the new order", { items: { type: "string" } }) }, required: ["book_id", "item_ids"] },
    async run(a, u) {
      const b = await ownBook(u, a.book_id);
      if (!b) return out("Book not found.", true);
      const items = b.structure as Json[];
      const order = (a.item_ids as string[]) ?? [];
      const picked = order.map((id) => items.find((i) => i.id === id)).filter(Boolean) as Json[];
      const rest = items.filter((i) => !order.includes(i.id as string));
      await db.from("books").update({ structure: [...picked, ...rest] }).eq("id", String(b.id));
      return out("Reordered.");
    },
  },
  {
    name: "export_pdf",
    title: "Export as PDF",
    description: "Get the link that lays out a book or a single work as print-ready A4 pages and opens the Save-as-PDF dialog (the writer opens it while signed in to Litma).",
    inputSchema: { type: "object", properties: { book_id: S("string", "Book id"), document_id: S("string", "Or a single document id") } },
    annotations: RO,
    async run(a, u) {
      if (a.book_id) {
        const b = await ownBook(u, a.book_id);
        return b ? out(`Open to export “${b.title}” as PDF:\n${SITE}/print/?book=${b.id}&auto=1`) : out("Book not found.", true);
      }
      const d = await ownDoc(u, a.document_id, "id,title");
      return d ? out(`Open to export “${d.title}” as PDF:\n${SITE}/print/?doc=${d.id}&auto=1`) : out("Give a book_id or document_id.", true);
    },
  },

  // ── Writer ────────────────────────────────────────────────────────────
  {
    name: "get_profile",
    title: "Writer profile",
    description: "The writer's name, pen name, bio, location, daily goal and preferences.",
    inputSchema: { type: "object", properties: {} },
    annotations: RO,
    async run(_a, u) {
      const { data } = await db.from("profiles").select("display_name,pen_name,username,bio,location,website,daily_goal,preferences").eq("id", u).maybeSingle();
      return outJson(data ?? {});
    },
  },
  {
    name: "writing_stats",
    title: "Writing stats",
    description: "Words written per day (last 60 days), current streak, totals per writing type.",
    inputSchema: { type: "object", properties: {} },
    annotations: RO,
    async run(_a, u) {
      const { data: days } = await db.from("writing_days").select("day,words").eq("user_id", u).order("day", { ascending: false }).limit(60);
      const { data: docs } = await db.from("documents").select("kind,word_count").eq("user_id", u).eq("archived", false);
      const map = new Map((days ?? []).map((d) => [d.day as string, d.words as number]));
      const d = new Date();
      const key = (x: Date) => x.toISOString().slice(0, 10);
      if (!map.get(key(d))) d.setDate(d.getDate() - 1);
      let streak = 0;
      while ((map.get(key(d)) ?? 0) > 0) {
        streak++;
        d.setDate(d.getDate() - 1);
      }
      const perWritingType: Record<string, { works: number; words: number }> = {};
      for (const x of docs ?? []) {
        const f = (perWritingType[x.kind] ??= { works: 0, words: 0 });
        f.works++;
        f.words += x.word_count;
      }
      return outJson({ streak, today: map.get(key(new Date())) ?? 0, days: days ?? [], perWritingType });
    },
  },
];

const byName = new Map(TOOLS.map((t) => [t.name, t]));
const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
const fail = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "") || new URL(req.url).searchParams.get("key") || "";
  if (!token.startsWith("litma_")) return null;
  const { data } = await db.from("mcp_tokens").select("id,user_id").eq("token_hash", await sha256(token)).maybeSingle();
  if (!data) return null;
  db.from("mcp_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return data.user_id as string;
}

async function handle(msg: Json, userId: string | null) {
  const { id, method, params } = msg as { id?: unknown; method: string; params?: Json };
  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: (params?.protocolVersion as string) || PROTOCOL,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "litma", title: "Litma · Malayalam writing desk", version: "0.3.0" },
        instructions:
          "Litma holds one writer's Malayalam literary work: documents (novels, stories, poems, screenplays, plays, features…), Story World notes, books and a dictionary. Read before changing anything. Write Malayalam in Unicode script, never Manglish (use transliterate if the writer types Manglish). Prefer suggest_edit for creative proposals; use direct edits only when asked, and save_version before large changes. Call get_writing_guide before writing for a writing type.",
      });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS.map(({ run: _r, ...t }) => t) });
    case "tools/call": {
      if (!userId) return ok(id, out("Not authorised. Create a token in Litma → Settings → MCP and send it as a Bearer token.", true));
      const tool = byName.get(String(params?.name));
      if (!tool) return ok(id, out(`Unknown tool: ${params?.name}`, true));
      recordUsage(db, userId, "mcp_call", tool.name);
      try {
        return ok(id, await tool.run((params?.arguments as Args) ?? {}, userId));
      } catch (e) {
        return ok(id, out(e instanceof Error ? e.message : "Tool failed", true));
      }
    }
    case "resources/list":
      return ok(id, { resources: [] });
    case "prompts/list":
      return ok(id, { prompts: [] });
    default:
      if (id === undefined) return null;
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
