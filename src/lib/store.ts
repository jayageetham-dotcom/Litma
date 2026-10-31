"use client";
/**
 * Litma data layer. Uses Supabase when configured, otherwise the browser's
 * localStorage ("local-only mode") so the app works out of the box.
 */
import type { JSONContent } from "@tiptap/core";
import { getSupabase } from "./supabase/client";
import { settingsFor, templateFor } from "./templates";
import type { DocKind, DocVersion, LitmaDoc, Profile, Suggestion } from "./types";
import { textToNodes } from "@/shared/serialize";
import { countWords } from "@/shared/manglish";

const LS_DOCS = "litma:docs";
const LS_VERSIONS = "litma:versions";

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

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
