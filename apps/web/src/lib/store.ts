"use client";
/**
 * Litma data layer. Uses Supabase when configured, otherwise the browser's
 * localStorage ("local-only mode") so the app works out of the box.
 *
 * With Supabase, every read refreshes a copy on this device and every write that can't reach
 * the server waits in an outbox (lib/offline.ts), so the web and desktop apps keep working
 * offline and catch up when the connection returns.
 */
import type { JSONContent } from "@tiptap/core";
import { getSupabase } from "./supabase/client";
import { track } from "./analytics";
import { templateFor } from "./templates";
import { newSettings, withAuthor } from "@litma/shared/forms";
import type { Book, DocKind, DocVersion, LitmaDoc, Profile, Suggestion, WordBookmark } from "./types";
import type { StoryItem, StoryKind } from "./story";
import { textToNodes } from "@litma/shared/serialize";
import { countWords } from "@litma/shared/manglish";
import { OfflineError, cache, enqueue, isNetworkError, currentUser, markServer, remote, syncFirst, type Op } from "./offline";

const LS_DOCS = "litma:docs";
const LS_VERSIONS = "litma:versions";
const LS_STORY = "litma:story";
const LS_BOOKS = "litma:books";
const LS_BOOKMARKS = "litma:bookmarks";

function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function lsSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

/** v4 UUID (rows made offline get their id here, so later changes can refer to them) */
const uuid = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const DOC_COLS = "id,title,kind,content,settings,word_count,is_public,share_id,archived,created_at,updated_at";
const LIST_COLS = "id,title,kind,settings,word_count,is_public,share_id,archived,created_at,updated_at,plain_text";
const now = () => new Date().toISOString();

/**
 * A work as kept on this device. `_server_at`: the server's updated_at when it last answered;
 * `_content_at`: the server's updated_at of the text kept here (offline edits are based on it).
 */
type KeptDoc = LitmaDoc & { plain_text?: string; _server_at?: string | null; _content_at?: string | null };

/** Server first (after sending anything still waiting); the copy on this device when offline. */
async function cloudRead<T>(fresh: () => Promise<T>, kept: () => Promise<T | null>): Promise<T> {
  if (await syncFirst()) {
    try {
      return await fresh();
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }
  const k = await kept();
  if (k !== null) return k;
  throw new OfflineError();
}

/**
 * Send a change now, or keep it in the outbox when the server can't be reached.
 * Resolves true when the change is waiting on this device.
 */
async function cloudWrite(op: Op, direct: () => Promise<unknown>): Promise<boolean> {
  if (await syncFirst()) {
    try {
      await direct();
      return false;
    } catch (e) {
      if (!isNetworkError(e)) throw e;
    }
  }
  await enqueue(op);
  return true;
}

/** The signed-in writer, or the one remembered on this device when the session can't be refreshed offline. */
const sessionUser = currentUser;

const excerptOf = (d: KeptDoc) => (d.plain_text ?? (d.content?.content ? plainText(d.content) : "")).replace(/\s+/g, " ").trim().slice(0, 220);
const listed = (d: KeptDoc): LitmaDoc => {
  const { plain_text: _p, _server_at: _s, _content_at: _c, ...rest } = d;
  void _p;
  void _s;
  void _c;
  return { ...rest, content: { type: "doc" }, excerpt: excerptOf(d) } as LitmaDoc;
};
const fullDoc = (d: KeptDoc): LitmaDoc => {
  const { plain_text: _p, _server_at: _s, _content_at: _c, ...rest } = d;
  void _p;
  void _s;
  void _c;
  return rest as LitmaDoc;
};

/** Keep the text of recently changed works on this device, so they open offline too. */
let prefetching = false;
async function prefetchDocs(rows: KeptDoc[]) {
  const sb = getSupabase();
  if (!sb || prefetching) return;
  prefetching = true;
  try {
    const kept = new Map((await cache.all<KeptDoc>("documents")).map((d) => [d.id, d]));
    const stale = rows.filter((r) => kept.get(r.id)?._content_at !== r.updated_at).slice(0, 60);
    for (let i = 0; i < stale.length; i += 10) {
      const ids = stale.slice(i, i + 10).map((r) => r.id);
      const data = (await remote(sb.from("documents").select(DOC_COLS).in("id", ids))) as LitmaDoc[];
      for (const d of data) await cache.merge<KeptDoc>("documents", d.id, { ...d, _server_at: d.updated_at, _content_at: d.updated_at });
    }
  } catch {
    /* offline again, or nothing to do: the next listing tries again */
  } finally {
    prefetching = false;
  }
}

/** Replace the kept rows of one listing with what the server sent (rows the server no longer has go). */
async function refreshKept<T extends { id: string }>(table: string, rows: T[], inScope: (r: T) => boolean) {
  const kept = await cache.all<T>(table);
  const ids = new Set(rows.map((r) => r.id));
  for (const k of kept) if (inScope(k) && !ids.has(k.id)) await cache.remove(table, k.id);
  for (const r of rows) await cache.merge<T>(table, r.id, r);
}

export function plainText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  const inner = (node.content ?? []).map(plainText).join(node.type === "doc" ? "\n" : node.type === "dialogue" ? "\n" : "");
  return node.type === "hardBreak" ? "\n" : inner;
}

/** versions of each work kept on this device for offline history */
const KEEP_VERSIONS = 20;

export const store = {
  isCloud() {
    return getSupabase() !== null;
  },

  async user() {
    const sb = getSupabase();
    if (!sb) return null;
    return sessionUser();
  },

  async listDocs(opts: { trash?: boolean } = {}): Promise<LitmaDoc[]> {
    const trash = !!opts.trash;
    const sb = getSupabase();
    if (!sb)
      return lsGet<LitmaDoc[]>(LS_DOCS, [])
        .filter((d) => !!d.archived === trash)
        .map((d) => ({ ...d, excerpt: plainText(d.content).replace(/\s+/g, " ").trim().slice(0, 220) }))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return cloudRead(
      async () => {
        const rows = ((await remote(sb.from("documents").select(LIST_COLS).eq("archived", trash).order("updated_at", { ascending: false }))) ?? []) as KeptDoc[];
        await refreshKept<KeptDoc>(
          "documents",
          rows.map((r) => ({ ...r, archived: !!r.archived, _server_at: r.updated_at }) as KeptDoc),
          (k) => !!k.archived === trash
        );
        if (!trash) void prefetchDocs(rows);
        return rows.map(listed);
      },
      async () =>
        (await cache.all<KeptDoc>("documents"))
          .filter((d) => !!d.archived === trash && d.title !== undefined)
          .map(listed)
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    );
  },

  async getDoc(id: string): Promise<LitmaDoc | null> {
    const sb = getSupabase();
    if (!sb) return lsGet<LitmaDoc[]>(LS_DOCS, []).find((d) => d.id === id) ?? null;
    return cloudRead(
      async () => {
        const row = (await remote(sb.from("documents").select(DOC_COLS).eq("id", id).maybeSingle())) as LitmaDoc | null;
        if (row) await cache.merge<KeptDoc>("documents", id, { ...row, _server_at: row.updated_at, _content_at: row.updated_at });
        else await cache.remove("documents", id);
        return row;
      },
      async () => {
        const d = await cache.get<KeptDoc>("documents", id);
        return d?.content?.type ? fullDoc(d) : null;
      }
    );
  },

  async createDoc(kind: DocKind, title?: string): Promise<LitmaDoc> {
    track("work_created", { kind });
    const t = templateFor(kind);
    const base = {
      title: title || `പുതിയ ${t.ml}`,
      kind,
      content: t.content(),
      settings: { ...newSettings(kind), pristine: true } as LitmaDoc["settings"],
      word_count: 0,
    };
    const sb = getSupabase();
    if (sb) {
      // honour the writer's default typing mode from their profile
      const prof = await this.getProfile().catch(() => null);
      const mode = prof?.preferences?.inputMode;
      if (mode === "manglish" || mode === "malayalam" || mode === "english") base.settings.inputMode = mode;
      // the author line starts with the writer's own name
      base.content = withAuthor(base.content, prof?.pen_name || prof?.display_name);
    }
    if (!sb) {
      const now = new Date().toISOString();
      const doc: LitmaDoc = { ...base, id: uuid(), created_at: now, updated_at: now };
      lsSet(LS_DOCS, [doc, ...lsGet<LitmaDoc[]>(LS_DOCS, [])]);
      return doc;
    }
    const row = { ...base, id: uuid() };
    let made: LitmaDoc | null = null;
    await cloudWrite({ kind: "insert", table: "documents", id: row.id, row }, async () => {
      made = (await remote(sb.from("documents").insert(row).select(DOC_COLS).single())) as LitmaDoc;
    });
    const at = now();
    const doc: LitmaDoc = made ?? { ...row, is_public: false, share_id: null, archived: false, created_at: at, updated_at: at };
    const serverAt = made ? (made as LitmaDoc).updated_at : null;
    await cache.put("documents", doc.id, { ...doc, archived: false, plain_text: "", _server_at: serverAt, _content_at: serverAt } satisfies KeptDoc);
    return doc;
  },

  async duplicateDoc(id: string): Promise<LitmaDoc | null> {
    const d = await this.getDoc(id);
    if (!d) return null;
    const copy = await this.createDoc(d.kind, `${d.title} (പകർപ്പ്)`);
    await this.updateDoc(copy.id, { content: d.content, settings: d.settings, word_count: d.word_count });
    return { ...copy, content: d.content, settings: d.settings };
  },

  /** Resolves true when the change is kept on this device until the connection returns. */
  async updateDoc(id: string, patch: Partial<LitmaDoc>): Promise<boolean> {
    const sb = getSupabase();
    const extra = patch.content ? { plain_text: plainText(patch.content).slice(0, 200000) } : {};
    if (!sb) {
      const docs = lsGet<LitmaDoc[]>(LS_DOCS, []);
      const i = docs.findIndex((d) => d.id === id);
      if (i >= 0) {
        docs[i] = { ...docs[i], ...patch, ...(extra as object), updated_at: new Date().toISOString() };
        lsSet(LS_DOCS, docs);
      }
      return false;
    }
    const change = { ...patch, ...extra } as Record<string, unknown>;
    const kept = await cache.get<KeptDoc>("documents", id);
    if (kept) await cache.put("documents", id, { ...kept, ...change, updated_at: now() });
    return cloudWrite({ kind: "update", table: "documents", id, patch: change, base: kept?._content_at ?? null }, async () => {
      const row = (await remote(sb.from("documents").update(change).eq("id", id).select("updated_at").maybeSingle())) as { updated_at: string } | null;
      await markServer(sb, id, "content" in change, row?.updated_at);
    });
  },

  /** Move to trash (restorable). */
  async trashDoc(id: string) {
    await this.updateDoc(id, { archived: true } as Partial<LitmaDoc>);
  },

  async restoreDoc(id: string) {
    await this.updateDoc(id, { archived: false } as Partial<LitmaDoc>);
  },

  /** Permanently delete every document in the trash. */
  async emptyTrash() {
    const docs = await this.listDocs({ trash: true });
    for (const d of docs) await this.deleteDoc(d.id);
  },

  /**
   * Discard new documents the writer opened but never typed in.
   * Called when the editor closes, and on the desk as a safety net for closed tabs.
   */
  async discardPristine(olderThanMinutes = 30) {
    const cutoff = Date.now() - olderThanMinutes * 60_000;
    const docs = await this.listDocs();
    const stale = docs.filter((d) => d.settings?.pristine && new Date(d.updated_at).getTime() < cutoff);
    for (const d of stale) await this.deleteDoc(d.id);
    return stale.length;
  },

  /** Create a document from imported text (.txt / .md). */
  async importText(kind: DocKind, title: string, text: string): Promise<LitmaDoc> {
    const doc = await this.createDoc(kind, title);
    const nodes = textToNodes(text, kind);
    const content = { type: "doc", content: [{ type: "styledBlock", attrs: { variant: "title" }, content: title ? [{ type: "text", text: title }] : undefined }, ...nodes] } as JSONContent;
    const words = countWords(plainText(content));
    await this.updateDoc(doc.id, { content, word_count: words, settings: { ...doc.settings, pristine: false } });
    return { ...doc, content };
  },

  async deleteDoc(id: string) {
    const sb = getSupabase();
    if (!sb) {
      lsSet(LS_DOCS, lsGet<LitmaDoc[]>(LS_DOCS, []).filter((d) => d.id !== id));
      lsSet(LS_VERSIONS, lsGet<DocVersion[]>(LS_VERSIONS, []).filter((v) => v.document_id !== id));
      return;
    }
    await cache.remove("documents", id);
    await cloudWrite({ kind: "delete", table: "documents", id }, () => remote(sb.from("documents").delete().eq("id", id)));
  },

  async setPublic(id: string, isPublic: boolean): Promise<string | null> {
    const share_id = isPublic ? uuid().replace(/-/g, "").slice(0, 12) : null;
    await this.updateDoc(id, { is_public: isPublic, share_id } as Partial<LitmaDoc>);
    return share_id;
  },

  async getShared(shareId: string): Promise<LitmaDoc | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.from("documents").select(DOC_COLS).eq("share_id", shareId).eq("is_public", true).maybeSingle();
    return data as LitmaDoc | null;
  },

  // ── profile ──
  async getProfile(): Promise<(Profile & { email?: string }) | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const user = await sessionUser();
    if (!user) return null;
    const base: Profile = { id: user.id, display_name: null, pen_name: null, username: null, bio: null, location: null, website: null, avatar_url: null, daily_goal: 500, preferences: {} };
    const data = await cloudRead(
      async () => {
        const row = (await remote(sb.from("profiles").select("*").eq("id", user.id).maybeSingle())) as Profile | null;
        if (row) await cache.put("profile", user.id, row);
        return row;
      },
      () => cache.get<Profile>("profile", user.id)
    ).catch((e) => {
      if (e instanceof OfflineError) return null;
      throw e;
    });
    return { ...base, ...(data ?? {}), email: user.email };
  },

  async updateProfile(patch: Partial<Profile>) {
    const sb = getSupabase();
    if (!sb) throw new Error("Profiles need a Supabase connection.");
    const user = await sessionUser();
    if (!user) throw new Error("Sign in first.");
    const row = { id: user.id, ...patch };
    await cache.merge("profile", user.id, row);
    await cloudWrite({ kind: "upsert", table: "profiles", id: user.id, row }, () => remote(sb.from("profiles").upsert(row)));
  },

  /** Upload a profile picture (already resized) to avatars/<uid>/avatar-<ts>.webp and save its public URL. */
  async uploadAvatar(blob: Blob): Promise<string> {
    const sb = getSupabase();
    if (!sb) throw new Error("Profile pictures need a Supabase connection.");
    const { data: u } = await sb.auth.getUser();
    if (!u.user) throw new Error("Sign in first.");
    const folder = u.user.id;
    const { data: old } = await sb.storage.from("avatars").list(folder);
    const path = `${folder}/avatar-${Date.now()}.webp`;
    const { error } = await sb.storage.from("avatars").upload(path, blob, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
    if (error) throw error;
    if (old?.length) await sb.storage.from("avatars").remove(old.map((f) => `${folder}/${f.name}`));
    const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await this.updateProfile({ avatar_url: url });
    return url;
  },

  async removeAvatar() {
    const sb = getSupabase();
    if (!sb) return;
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return;
    const { data: old } = await sb.storage.from("avatars").list(u.user.id);
    if (old?.length) await sb.storage.from("avatars").remove(old.map((f) => `${u.user!.id}/${f.name}`));
    await this.updateProfile({ avatar_url: null });
  },

  // ── Story World ──
  async listStory(docId: string): Promise<StoryItem[]> {
    const sb = getSupabase();
    if (!sb) return lsGet<StoryItem[]>(LS_STORY, []).filter((i) => i.document_id === docId).sort((a, b) => a.position - b.position);
    const order = (a: StoryItem, b: StoryItem) => a.position - b.position || (a.created_at ?? "").localeCompare(b.created_at ?? "");
    return cloudRead(
      async () => {
        const rows = ((await remote(sb.from("story_items").select("*").eq("document_id", docId).order("position").order("created_at"))) ?? []) as StoryItem[];
        await refreshKept<StoryItem>("story_items", rows, (k) => k.document_id === docId);
        return rows;
      },
      async () => (await cache.all<StoryItem>("story_items")).filter((i) => i.document_id === docId).sort(order)
    );
  },

  async saveStory(item: Partial<StoryItem> & { document_id: string; kind: StoryKind }): Promise<StoryItem> {
    const row = { name: "", summary: "", data: {}, image_url: null, position: Date.now() % 1e9, ...item };
    const sb = getSupabase();
    if (!sb) {
      const all = lsGet<StoryItem[]>(LS_STORY, []);
      const now = new Date().toISOString();
      const saved = { ...row, id: row.id ?? uuid(), updated_at: now, created_at: row.created_at ?? now } as StoryItem;
      const i = all.findIndex((x) => x.id === saved.id);
      if (i >= 0) all[i] = saved;
      else all.push(saved);
      lsSet(LS_STORY, all);
      return saved;
    }
    const { id: given, created_at: _c, updated_at: _u, ...rest } = row as StoryItem;
    void _c;
    void _u;
    const id = given ?? uuid();
    let saved: StoryItem | null = null;
    const op: Op = given ? { kind: "update", table: "story_items", id, patch: rest } : { kind: "insert", table: "story_items", id, row: { ...rest, id } };
    await cloudWrite(op, async () => {
      saved = (await remote(given ? sb.from("story_items").update(rest).eq("id", id).select("*").single() : sb.from("story_items").insert({ ...rest, id }).select("*").single())) as StoryItem;
    });
    const at = now();
    const kept = await cache.get<StoryItem>("story_items", id);
    const result: StoryItem = saved ?? ({ ...kept, ...rest, id, created_at: kept?.created_at ?? row.created_at ?? at, updated_at: at } as StoryItem);
    await cache.put("story_items", id, result);
    return result;
  },

  async deleteStory(id: string) {
    const sb = getSupabase();
    if (!sb) {
      lsSet(LS_STORY, lsGet<StoryItem[]>(LS_STORY, []).filter((x) => x.id !== id));
      return;
    }
    await cache.remove("story_items", id);
    await cloudWrite({ kind: "delete", table: "story_items", id }, () => remote(sb.from("story_items").delete().eq("id", id)));
  },

  /** Upload an image to media/<uid>/<folder>/… and return its public URL. */
  async uploadMedia(blob: Blob, folder: string): Promise<string> {
    const sb = getSupabase();
    if (!sb) {
      // local mode: keep a data URL (fine for a few small images)
      return await new Promise((res) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result));
        r.readAsDataURL(blob);
      });
    }
    const { data: u } = await sb.auth.getUser();
    if (!u.user) throw new Error("Sign in first.");
    const path = `${u.user.id}/${folder}/${uuid()}.webp`;
    const { error } = await sb.storage.from("media").upload(path, blob, { contentType: blob.type || "image/webp", cacheControl: "31536000" });
    if (error) throw error;
    return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
  },

  // ── books ──
  async listBooks(): Promise<Book[]> {
    const sb = getSupabase();
    if (!sb) return lsGet<Book[]>(LS_BOOKS, []).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return cloudRead(
      async () => {
        const rows = ((await remote(sb.from("books").select("*").order("updated_at", { ascending: false }))) ?? []) as Book[];
        await refreshKept<Book>("books", rows, () => true);
        return rows;
      },
      async () => (await cache.all<Book>("books")).filter((b) => b.title !== undefined).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    );
  },

  async getBook(id: string): Promise<Book | null> {
    const sb = getSupabase();
    if (!sb) return lsGet<Book[]>(LS_BOOKS, []).find((b) => b.id === id) ?? null;
    return cloudRead(
      async () => {
        const row = (await remote(sb.from("books").select("*").eq("id", id).maybeSingle())) as Book | null;
        if (row) await cache.put("books", id, row);
        else await cache.remove("books", id);
        return row;
      },
      () => cache.get<Book>("books", id)
    );
  },

  async createBook(init: Partial<Book>): Promise<Book> {
    track("book_created");
    const sb = getSupabase();
    if (!sb) {
      const now = new Date().toISOString();
      const b = { id: uuid(), title: "പുതിയ പുസ്തകം", subtitle: null, author: null, structure: [], settings: {}, cover: {}, created_at: now, updated_at: now, ...init } as Book;
      lsSet(LS_BOOKS, [b, ...lsGet<Book[]>(LS_BOOKS, [])]);
      return b;
    }
    const row = { ...init, id: init.id ?? uuid() };
    let made: Book | null = null;
    await cloudWrite({ kind: "insert", table: "books", id: row.id, row: row as Record<string, unknown> }, async () => {
      made = (await remote(sb.from("books").insert(row).select("*").single())) as Book;
    });
    const at = now();
    const book: Book = made ?? ({ title: "പുതിയ പുസ്തകം", subtitle: null, author: null, structure: [], settings: {}, cover: {}, created_at: at, updated_at: at, ...row } as Book);
    await cache.put("books", book.id, book);
    return book;
  },

  async updateBook(id: string, patch: Partial<Book>) {
    const sb = getSupabase();
    if (!sb) {
      const all = lsGet<Book[]>(LS_BOOKS, []);
      const i = all.findIndex((b) => b.id === id);
      if (i >= 0) {
        all[i] = { ...all[i], ...patch, updated_at: new Date().toISOString() };
        lsSet(LS_BOOKS, all);
      }
      return;
    }
    const kept = await cache.get<Book>("books", id);
    if (kept) await cache.put("books", id, { ...kept, ...patch, updated_at: now() });
    await cloudWrite({ kind: "update", table: "books", id, patch: patch as Record<string, unknown> }, () => remote(sb.from("books").update(patch).eq("id", id)));
  },

  async deleteBook(id: string) {
    const sb = getSupabase();
    if (!sb) {
      lsSet(LS_BOOKS, lsGet<Book[]>(LS_BOOKS, []).filter((b) => b.id !== id));
      return;
    }
    await cache.remove("books", id);
    await cloudWrite({ kind: "delete", table: "books", id }, () => remote(sb.from("books").delete().eq("id", id)));
  },

  // ── versions ──
  async listVersions(docId: string): Promise<DocVersion[]> {
    const sb = getSupabase();
    if (!sb)
      return lsGet<DocVersion[]>(LS_VERSIONS, [])
        .filter((v) => v.document_id === docId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return cloudRead(
      async () => {
        const rows = ((await remote(sb.from("document_versions").select("id,document_id,label,content,word_count,created_at").eq("document_id", docId).order("created_at", { ascending: false }).limit(100))) ?? []) as DocVersion[];
        await cache.put("versions", docId, rows.slice(0, KEEP_VERSIONS));
        return rows;
      },
      async () => (await cache.get<DocVersion[]>("versions", docId)) ?? []
    ).catch(() => []);
  },

  async saveVersion(docId: string, content: JSONContent, word_count: number, label: string | null) {
    const sb = getSupabase();
    if (!sb) {
      const all = lsGet<DocVersion[]>(LS_VERSIONS, []);
      const mine = all.filter((v) => v.document_id === docId);
      const others = all.filter((v) => v.document_id !== docId);
      mine.unshift({ id: uuid(), document_id: docId, label, content, word_count, created_at: new Date().toISOString() });
      lsSet(LS_VERSIONS, [...others, ...mine.slice(0, 40)]);
      return;
    }
    const row = { id: uuid(), document_id: docId, content, word_count, label };
    const kept = (await cache.get<DocVersion[]>("versions", docId)) ?? [];
    await cache.put("versions", docId, [{ ...row, created_at: now() }, ...kept].slice(0, KEEP_VERSIONS));
    await cloudWrite({ kind: "insert", table: "document_versions", id: row.id, row }, () => remote(sb.from("document_versions").insert(row)));
  },

  async addWordsToday(n: number) {
    const sb = getSupabase();
    if (!sb || n <= 0) return;
    await cloudWrite({ kind: "rpc", fn: "add_words_today", args: { n } }, () => remote(sb.rpc("add_words_today", { n })));
  },

  async wordsByDay(): Promise<{ day: string; words: number }[]> {
    const sb = getSupabase();
    if (!sb) return [];
    type Day = { day: string; words: number };
    const me = (await sessionUser())?.id ?? "me";
    return cloudRead(
      async () => {
        const rows = ((await remote(sb.from("writing_days").select("day,words").order("day", { ascending: false }).limit(140))) ?? []) as Day[];
        await cache.put("days", me, rows);
        return rows;
      },
      async () => (await cache.get<Day[]>("days", me)) ?? []
    ).catch(() => []);
  },

  // ── AI suggestions inbox (MCP) ──
  async listSuggestions(docId: string): Promise<Suggestion[]> {
    const sb = getSupabase();
    if (!sb) return [];
    return cloudRead(
      async () => {
        const rows = ((await remote(sb.from("suggestions").select("*").eq("document_id", docId).eq("status", "pending").order("created_at", { ascending: false }))) ?? []) as Suggestion[];
        await cache.put("suggestions", docId, rows);
        return rows;
      },
      async () => (await cache.get<Suggestion[]>("suggestions", docId)) ?? []
    ).catch(() => []);
  },

  async setSuggestionStatus(id: string, status: "accepted" | "dismissed") {
    const sb = getSupabase();
    if (!sb) return;
    await cloudWrite({ kind: "update", table: "suggestions", id, patch: { status } }, () => remote(sb.from("suggestions").update({ status }).eq("id", id))).catch(() => {});
  },

  subscribeSuggestions(docId: string, onChange: () => void) {
    const sb = getSupabase();
    if (!sb) return () => {};
    const ch = sb
      .channel(`suggestions-${docId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "suggestions", filter: `document_id=eq.${docId}` }, onChange)
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  },

  // ── MCP tokens ──
  async listTokens() {
    const sb = getSupabase();
    if (!sb) return [];
    type Token = { id: string; name: string; created_at: string; last_used_at: string | null };
    const me = (await sessionUser())?.id ?? "me";
    return cloudRead(
      async () => {
        const rows = ((await remote(sb.from("mcp_tokens").select("id,name,created_at,last_used_at").order("created_at", { ascending: false }))) ?? []) as Token[];
        await cache.put("tokens", me, rows);
        return rows;
      },
      async () => (await cache.get<Token[]>("tokens", me)) ?? []
    ).catch(() => [] as Token[]);
  },

  async createToken(name: string): Promise<string> {
    const sb = getSupabase();
    if (!sb) throw new Error("Connect Supabase to create MCP tokens.");
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const token = "litma_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const hash = await sha256(token);
    const { error } = await sb.from("mcp_tokens").insert({ name, token_hash: hash });
    if (error) throw error;
    return token;
  },

  async deleteToken(id: string) {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("mcp_tokens").delete().eq("id", id);
  },
};

/** the bookmarks table arrives with a migration; until it exists, keep bookmarks in this browser */
const missingTable = (e: unknown) => {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === "42P01" || err?.code === "PGRST205" || /word_bookmarks/.test(err?.message ?? "");
};
function notifyBookmarks() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("litma:bookmarks"));
}

/** Words saved from the dictionary (Supabase when available, else localStorage). */
export const bookmarks = {
  async list(): Promise<WordBookmark[]> {
    const sb = getSupabase();
    if (sb) {
      const me = (await sessionUser())?.id ?? "me";
      try {
        return await cloudRead(
          async () => {
            const rows = ((await remote(sb.from("word_bookmarks").select("id,word,lang,meaning,synonyms,note,created_at").order("created_at", { ascending: false }))) ?? []) as WordBookmark[];
            await cache.put("bookmarks", me, rows);
            return rows;
          },
          () => cache.get<WordBookmark[]>("bookmarks", me)
        );
      } catch (e) {
        if (!missingTable(e) && !(e instanceof OfflineError)) throw e;
      }
    }
    return lsGet<WordBookmark[]>(LS_BOOKMARKS, []);
  },
  async add(b: Omit<WordBookmark, "id" | "created_at">): Promise<WordBookmark> {
    const sb = getSupabase();
    const row = { ...b, meaning: b.meaning?.slice(0, 600) ?? null, synonyms: (b.synonyms ?? []).slice(0, 12) };
    if (sb) {
      const me = (await sessionUser())?.id ?? "me";
      let saved: WordBookmark | null = null;
      try {
        await cloudWrite({ kind: "upsert", table: "word_bookmarks", id: b.word, row, onConflict: "user_id,word" }, async () => {
          saved = (await remote(sb.from("word_bookmarks").upsert(row, { onConflict: "user_id,word" }).select("id,word,lang,meaning,synonyms,note,created_at").single())) as WordBookmark;
        });
        const item: WordBookmark = saved ?? { ...row, id: uuid(), created_at: now() };
        const kept = ((await cache.get<WordBookmark[]>("bookmarks", me)) ?? []).filter((x) => x.word !== b.word);
        await cache.put("bookmarks", me, [item, ...kept]);
        notifyBookmarks();
        return item;
      } catch (e) {
        if (!missingTable(e)) throw e;
      }
    }
    const all = lsGet<WordBookmark[]>(LS_BOOKMARKS, []).filter((x) => x.word !== b.word);
    const item: WordBookmark = { ...row, id: uuid(), created_at: new Date().toISOString() };
    lsSet(LS_BOOKMARKS, [item, ...all]);
    notifyBookmarks();
    return item;
  },
  async remove(word: string) {
    const sb = getSupabase();
    if (sb) {
      const me = (await sessionUser())?.id ?? "me";
      try {
        await cloudWrite({ kind: "delete", table: "word_bookmarks", match: { word } }, () => remote(sb.from("word_bookmarks").delete().eq("word", word)));
        await cache.put("bookmarks", me, ((await cache.get<WordBookmark[]>("bookmarks", me)) ?? []).filter((x) => x.word !== word));
        return notifyBookmarks();
      } catch (e) {
        if (!missingTable(e)) throw e;
      }
    }
    lsSet(LS_BOOKMARKS, lsGet<WordBookmark[]>(LS_BOOKMARKS, []).filter((x) => x.word !== word));
    notifyBookmarks();
  },
};

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
