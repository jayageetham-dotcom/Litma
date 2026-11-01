"use client";
/**
 * Litma data layer. Uses Supabase when configured, otherwise the browser's
 * localStorage ("local-only mode") so the app works out of the box.
 */
import type { JSONContent } from "@tiptap/core";
import { getSupabase } from "./supabase/client";
import { settingsFor, templateFor } from "./templates";
import type { Book, DocKind, DocVersion, LitmaDoc, Profile, Suggestion, WordBookmark } from "./types";
import type { StoryItem, StoryKind } from "./story";
import { textToNodes } from "@litma/shared/serialize";
import { countWords } from "@litma/shared/manglish";

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

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const DOC_COLS = "id,title,kind,content,settings,word_count,is_public,share_id,created_at,updated_at";

export function plainText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? "";
  const inner = (node.content ?? []).map(plainText).join(node.type === "doc" ? "\n" : node.type === "dialogue" ? "\n" : "");
  return node.type === "hardBreak" ? "\n" : inner;
}

export const store = {
  isCloud() {
    return getSupabase() !== null;
  },

  async user() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getUser();
    return data.user;
  },

  async listDocs(opts: { trash?: boolean } = {}): Promise<LitmaDoc[]> {
    const trash = !!opts.trash;
    const sb = getSupabase();
    if (!sb)
      return lsGet<LitmaDoc[]>(LS_DOCS, [])
        .filter((d) => !!d.archived === trash)
        .map((d) => ({ ...d, excerpt: plainText(d.content).replace(/\s+/g, " ").trim().slice(0, 220) }))
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const { data, error } = await sb
      .from("documents")
      .select("id,title,kind,settings,word_count,is_public,share_id,archived,created_at,updated_at,plain_text")
      .eq("archived", trash)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((d) => ({ ...d, content: { type: "doc" }, excerpt: (d.plain_text as string)?.replace(/\s+/g, " ").trim().slice(0, 220) })) as LitmaDoc[];
  },

  async getDoc(id: string): Promise<LitmaDoc | null> {
    const sb = getSupabase();
    if (!sb) return lsGet<LitmaDoc[]>(LS_DOCS, []).find((d) => d.id === id) ?? null;
    const { data, error } = await sb.from("documents").select(DOC_COLS).eq("id", id).maybeSingle();
    if (error) throw error;
    return data as LitmaDoc | null;
  },

  async createDoc(kind: DocKind, title?: string): Promise<LitmaDoc> {
    const t = templateFor(kind);
    const base = {
      title: title || `പുതിയ ${t.ml}`,
      kind,
      content: t.content(),
      settings: { ...settingsFor(kind), pristine: true } as LitmaDoc["settings"],
      word_count: 0,
    };
    const sb = getSupabase();
    if (sb) {
      // honour the writer's default typing mode from their profile
      const prof = await this.getProfile().catch(() => null);
      const mode = prof?.preferences?.inputMode;
      if (mode === "manglish" || mode === "malayalam" || mode === "english") base.settings.inputMode = mode;
    }
    if (!sb) {
      const now = new Date().toISOString();
      const doc: LitmaDoc = { ...base, id: uuid(), created_at: now, updated_at: now };
      lsSet(LS_DOCS, [doc, ...lsGet<LitmaDoc[]>(LS_DOCS, [])]);
      return doc;
    }
    const { data, error } = await sb.from("documents").insert(base).select(DOC_COLS).single();
    if (error) throw error;
    return data as LitmaDoc;
  },

  async duplicateDoc(id: string): Promise<LitmaDoc | null> {
    const d = await this.getDoc(id);
    if (!d) return null;
    const copy = await this.createDoc(d.kind, `${d.title} (പകർപ്പ്)`);
    await this.updateDoc(copy.id, { content: d.content, settings: d.settings, word_count: d.word_count });
    return { ...copy, content: d.content, settings: d.settings };
  },

  async updateDoc(id: string, patch: Partial<LitmaDoc>) {
    const sb = getSupabase();
    const extra = patch.content ? { plain_text: plainText(patch.content).slice(0, 200000) } : {};
    if (!sb) {
      const docs = lsGet<LitmaDoc[]>(LS_DOCS, []);
      const i = docs.findIndex((d) => d.id === id);
      if (i >= 0) {
        docs[i] = { ...docs[i], ...patch, ...(extra as object), updated_at: new Date().toISOString() };
        lsSet(LS_DOCS, docs);
      }
      return;
    }
    const { error } = await sb.from("documents").update({ ...patch, ...extra }).eq("id", id);
    if (error) throw error;
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
    const { error } = await sb.from("documents").delete().eq("id", id);
    if (error) throw error;
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
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return null;
    const { data } = await sb.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
    const base: Profile = { id: u.user.id, display_name: null, pen_name: null, username: null, bio: null, location: null, website: null, avatar_url: null, daily_goal: 500, preferences: {} };
    return { ...base, ...(data ?? {}), email: u.user.email };
  },

  async updateProfile(patch: Partial<Profile>) {
    const sb = getSupabase();
    if (!sb) throw new Error("Profiles need a Supabase connection.");
    const { data: u } = await sb.auth.getUser();
    if (!u.user) throw new Error("Sign in first.");
    const { error } = await sb.from("profiles").upsert({ id: u.user.id, ...patch });
    if (error) throw error;
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
    const { data, error } = await sb.from("story_items").select("*").eq("document_id", docId).order("position").order("created_at");
    if (error) throw error;
    return (data ?? []) as StoryItem[];
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
    const { id, created_at: _c, updated_at: _u, ...rest } = row as StoryItem;
    void _c;
    void _u;
    const q = id ? sb.from("story_items").update(rest).eq("id", id).select("*").single() : sb.from("story_items").insert(rest).select("*").single();
    const { data, error } = await q;
    if (error) throw error;
    return data as StoryItem;
  },

  async deleteStory(id: string) {
    const sb = getSupabase();
    if (!sb) {
      lsSet(LS_STORY, lsGet<StoryItem[]>(LS_STORY, []).filter((x) => x.id !== id));
      return;
    }
    const { error } = await sb.from("story_items").delete().eq("id", id);
    if (error) throw error;
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
    const { data, error } = await sb.from("books").select("*").order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as Book[];
  },

  async getBook(id: string): Promise<Book | null> {
    const sb = getSupabase();
    if (!sb) return lsGet<Book[]>(LS_BOOKS, []).find((b) => b.id === id) ?? null;
    const { data, error } = await sb.from("books").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as Book | null;
  },

  async createBook(init: Partial<Book>): Promise<Book> {
    const sb = getSupabase();
    if (!sb) {
      const now = new Date().toISOString();
      const b = { id: uuid(), title: "പുതിയ പുസ്തകം", subtitle: null, author: null, structure: [], settings: {}, cover: {}, created_at: now, updated_at: now, ...init } as Book;
      lsSet(LS_BOOKS, [b, ...lsGet<Book[]>(LS_BOOKS, [])]);
      return b;
    }
    const { data, error } = await sb.from("books").insert(init).select("*").single();
    if (error) throw error;
    return data as Book;
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
    const { error } = await sb.from("books").update(patch).eq("id", id);
    if (error) throw error;
  },

  async deleteBook(id: string) {
    const sb = getSupabase();
    if (!sb) {
      lsSet(LS_BOOKS, lsGet<Book[]>(LS_BOOKS, []).filter((b) => b.id !== id));
      return;
    }
    const { error } = await sb.from("books").delete().eq("id", id);
    if (error) throw error;
  },

  // ── versions ──
  async listVersions(docId: string): Promise<DocVersion[]> {
    const sb = getSupabase();
    if (!sb)
      return lsGet<DocVersion[]>(LS_VERSIONS, [])
        .filter((v) => v.document_id === docId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const { data } = await sb
      .from("document_versions")
      .select("id,document_id,label,content,word_count,created_at")
      .eq("document_id", docId)
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as DocVersion[];
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
    await sb.from("document_versions").insert({ document_id: docId, content, word_count, label });
  },

  async addWordsToday(n: number) {
    const sb = getSupabase();
    if (!sb || n <= 0) return;
    await sb.rpc("add_words_today", { n });
  },

  async wordsByDay(): Promise<{ day: string; words: number }[]> {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb.from("writing_days").select("day,words").order("day", { ascending: false }).limit(140);
    return (data ?? []) as { day: string; words: number }[];
  },

  // ── AI suggestions inbox (MCP) ──
  async listSuggestions(docId: string): Promise<Suggestion[]> {
    const sb = getSupabase();
    if (!sb) return [];
    const { data } = await sb
      .from("suggestions")
      .select("*")
      .eq("document_id", docId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    return (data ?? []) as Suggestion[];
  },

  async setSuggestionStatus(id: string, status: "accepted" | "dismissed") {
    const sb = getSupabase();
    if (!sb) return;
    await sb.from("suggestions").update({ status }).eq("id", id);
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
    const { data } = await sb.from("mcp_tokens").select("id,name,created_at,last_used_at").order("created_at", { ascending: false });
    return data ?? [];
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
      const { data, error } = await sb.from("word_bookmarks").select("id,word,lang,meaning,synonyms,note,created_at").order("created_at", { ascending: false });
      if (!error) return (data ?? []) as WordBookmark[];
      if (!missingTable(error)) throw error;
    }
    return lsGet<WordBookmark[]>(LS_BOOKMARKS, []);
  },
  async add(b: Omit<WordBookmark, "id" | "created_at">): Promise<WordBookmark> {
    const sb = getSupabase();
    const row = { ...b, meaning: b.meaning?.slice(0, 600) ?? null, synonyms: (b.synonyms ?? []).slice(0, 12) };
    if (sb) {
      const { data, error } = await sb.from("word_bookmarks").upsert(row, { onConflict: "user_id,word" }).select("id,word,lang,meaning,synonyms,note,created_at").single();
      if (!error) {
        notifyBookmarks();
        return data as WordBookmark;
      }
      if (!missingTable(error)) throw error;
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
      const { error } = await sb.from("word_bookmarks").delete().eq("word", word);
      if (!error) return notifyBookmarks();
      if (!missingTable(error)) throw error;
    }
    lsSet(LS_BOOKMARKS, lsGet<WordBookmark[]>(LS_BOOKMARKS, []).filter((x) => x.word !== word));
    notifyBookmarks();
  },
};

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
