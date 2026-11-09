"use client";
/**
 * Litma Community (/community/): threads and replies between signed-in writers.
 *
 * Cloud mode talks to the community_* tables and functions (migration 20261109120000_community.sql),
 * whose row-level security and triggers do the real checks: who may post, author names, closed
 * threads, rate limits and moderation. Local mode (no Supabase) keeps a small forum in localStorage
 * with the local writer as an admin, so the screens can be tried and tested without a server.
 */
import { getSupabase } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/config";

/** Bump with community_guidelines_version() in the migration when writers must agree again. */
export const COMMUNITY_GUIDELINES_VERSION = "2026-11-09";

export type Category = "news" | "general" | "craft" | "language" | "feedback" | "help";
export type Tint = "violet" | "coral" | "sky" | "lime" | "tangerine";

/** Categories in the order they are shown. `news` is for Litma's own announcements (admins only). */
export const CATEGORIES: { id: Category; tint: Tint }[] = [
  { id: "news", tint: "violet" },
  { id: "general", tint: "sky" },
  { id: "craft", tint: "coral" },
  { id: "language", tint: "lime" },
  { id: "feedback", tint: "tangerine" },
  { id: "help", tint: "violet" },
];
export const isCategory = (v: unknown): v is Category => CATEGORIES.some((c) => c.id === v);
export const categoryTint = (c: Category): Tint => CATEGORIES.find((x) => x.id === c)?.tint ?? "violet";

export const REPORT_REASONS = ["hate", "harassment", "sexual", "violence", "privacy", "copyright", "spam", "illegal", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const MOD_REASONS = ["hate", "harassment", "sexual", "violence", "privacy", "copyright", "spam", "illegal", "off_topic", "other"] as const;
export type ModReason = (typeof MOD_REASONS)[number];
export type ModAction = "close" | "reopen" | "remove" | "restore" | "pin" | "unpin" | "remove_reply" | "restore_reply";

export const LIMITS = { title: 140, thread: 10000, reply: 5000, note: 500 };

export interface Author {
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  author_tint: string | null;
}
export interface Thread extends Author {
  id: string;
  category: Category;
  title: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  last_activity_at: string;
  reply_count: number;
  like_count: number;
  status: "open" | "closed" | "removed";
  pinned: boolean;
  mod_reason: ModReason | null;
  mod_note: string | null;
  deleted_at: string | null;
}
export interface Reply extends Author {
  id: string;
  thread_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  like_count: number;
  removed: boolean;
  mod_reason: ModReason | null;
  deleted_at: string | null;
}
export interface Me {
  user_id: string | null;
  version: string;
  agreed: boolean;
  banned_until: string | null;
  ban_reason: string | null;
  is_admin: boolean;
}
export interface QueueItem {
  id: string;
  created_at: string;
  status: "open" | "resolved" | "dismissed";
  reason: ReportReason;
  note: string | null;
  thread_id: string;
  thread_title: string;
  thread_status: Thread["status"];
  reply_id: string | null;
  excerpt: string;
  author_id: string;
  author_name: string;
  reports_on_post: number;
  author_banned_until: string | null;
}

/** What went wrong, as a key the page turns into words. */
export type CommunityProblem = "slow_down" | "not_allowed" | "offline" | "not_found" | "failed";
export class CommunityError extends Error {
  constructor(public problem: CommunityProblem, message?: string) {
    super(message ?? problem);
  }
}
function problemOf(e: { message?: string; code?: string } | null | undefined): CommunityProblem {
  const m = `${e?.message ?? ""}`;
  if (/community_slow_down/.test(m)) return "slow_down";
  if (/row-level security|not_admin|permission denied|42501/.test(m) || e?.code === "42501") return "not_allowed";
  if (/community_not_found/.test(m)) return "not_found";
  if (/Failed to fetch|NetworkError|network|Load failed/i.test(m)) return "offline";
  return "failed";
}
async function run<T>(p: PromiseLike<{ data: T; error: { message: string; code?: string } | null }>): Promise<T> {
  let res: { data: T; error: { message: string; code?: string } | null };
  try {
    res = await p;
  } catch (e) {
    throw new CommunityError(problemOf(e as Error), (e as Error).message);
  }
  if (res.error) throw new CommunityError(problemOf(res.error), res.error.message);
  return res.data;
}

const THREAD_COLS = "id, author_id, author_name, author_avatar, author_tint, category, title, body, created_at, edited_at, last_activity_at, reply_count, like_count, status, pinned, mod_reason, mod_note, deleted_at";
const REPLY_COLS = "id, thread_id, author_id, author_name, author_avatar, author_tint, body, created_at, edited_at, like_count, removed, mod_reason, deleted_at";
export const PAGE = 30;

// ── local mode (localStorage) ──

const LOCAL_KEY = "litma:community";
const LOCAL_ID = "local";
type LocalDb = { threads: Thread[]; replies: Reply[]; likes: string[]; reports: (QueueItem & { reporter: string })[]; agreed: string | null };
const loadLocal = (): LocalDb => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) return JSON.parse(raw) as LocalDb;
  } catch {}
  return { threads: [], replies: [], likes: [], reports: [], agreed: null };
};
const saveLocal = (db: LocalDb) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(db));
  } catch {}
};
const now = () => new Date().toISOString();
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
function localAuthor(): Author {
  let name = "";
  let avatar: string | null = null;
  let tint: string | null = null;
  try {
    const p = JSON.parse(localStorage.getItem("litma:profile") ?? "null");
    name = p?.pen_name || p?.display_name || "";
    avatar = p?.preferences?.avatar ?? null;
    tint = p?.preferences?.avatarTint ?? null;
  } catch {}
  return { author_id: LOCAL_ID, author_name: name || "Litma writer", author_avatar: avatar, author_tint: tint };
}
function recount(db: LocalDb, threadId: string) {
  const t = db.threads.find((x) => x.id === threadId);
  if (!t) return;
  const live = db.replies.filter((r) => r.thread_id === threadId && !r.removed && !r.deleted_at);
  t.reply_count = live.length;
  t.last_activity_at = live.reduce((m, r) => (r.created_at > m ? r.created_at : m), t.created_at);
}

// ── the API the pages use ──

async function uid(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return LOCAL_ID;
  const { data } = await sb.auth.getSession();
  return data.session?.user.id ?? null;
}

export const isLocalCommunity = () => !isSupabaseConfigured;

export const community = {
  async me(): Promise<Me> {
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      return { user_id: LOCAL_ID, version: COMMUNITY_GUIDELINES_VERSION, agreed: db.agreed === COMMUNITY_GUIDELINES_VERSION, banned_until: null, ban_reason: null, is_admin: true };
    }
    const id = await uid();
    const data = await run(sb.rpc("community_me"));
    return { ...(data as Omit<Me, "user_id">), user_id: id };
  },

  async agree(): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      db.agreed = COMMUNITY_GUIDELINES_VERSION;
      saveLocal(db);
      return;
    }
    await run(sb.rpc("community_agree", { p_version: COMMUNITY_GUIDELINES_VERSION }));
  },

  /** Newest activity first, pinned threads on top. `page` counts from 0. */
  async threads(category: Category | null, page = 0): Promise<Thread[]> {
    const sb = getSupabase();
    if (!sb) {
      const list = loadLocal()
        .threads.filter((t) => !t.deleted_at && (!category || t.category === category))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.last_activity_at.localeCompare(a.last_activity_at));
      return list.slice(page * PAGE, (page + 1) * PAGE);
    }
    let q = sb.from("community_threads").select(THREAD_COLS).is("deleted_at", null);
    if (category) q = q.eq("category", category);
    const rows = await run(q.order("pinned", { ascending: false }).order("last_activity_at", { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1));
    return (rows ?? []) as unknown as Thread[];
  },

  async thread(id: string): Promise<Thread | null> {
    const sb = getSupabase();
    if (!sb) return loadLocal().threads.find((t) => t.id === id && !t.deleted_at) ?? null;
    const row = await run(sb.from("community_threads").select(THREAD_COLS).eq("id", id).maybeSingle());
    return (row as unknown as Thread) ?? null;
  },

  async replies(threadId: string): Promise<Reply[]> {
    const sb = getSupabase();
    if (!sb) return loadLocal().replies.filter((r) => r.thread_id === threadId && !r.deleted_at).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const rows = await run(sb.from("community_replies").select(REPLY_COLS).eq("thread_id", threadId).is("deleted_at", null).order("created_at").limit(1000));
    return (rows ?? []) as unknown as Reply[];
  },

  async createThread(input: { category: Category; title: string; body: string }): Promise<Thread> {
    const row = { category: input.category, title: input.title.trim(), body: input.body.trim() };
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      const t: Thread = { ...localAuthor(), ...row, id: newId(), created_at: now(), edited_at: null, last_activity_at: now(), reply_count: 0, like_count: 0, status: "open", pinned: false, mod_reason: null, mod_note: null, deleted_at: null };
      db.threads.push(t);
      saveLocal(db);
      return t;
    }
    return (await run(sb.from("community_threads").insert(row).select(THREAD_COLS).single())) as unknown as Thread;
  },

  async editThread(id: string, patch: { title: string; body: string; category: Category }): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      const t = db.threads.find((x) => x.id === id);
      if (t && t.status === "open") Object.assign(t, { title: patch.title.trim(), body: patch.body.trim(), category: patch.category, edited_at: now() });
      saveLocal(db);
      return;
    }
    await run(sb.from("community_threads").update({ title: patch.title.trim(), body: patch.body.trim(), category: patch.category }).eq("id", id));
  },

  async reply(threadId: string, body: string): Promise<Reply> {
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      const t = db.threads.find((x) => x.id === threadId);
      if (!t || t.status !== "open") throw new CommunityError("not_allowed");
      const r: Reply = { ...localAuthor(), id: newId(), thread_id: threadId, body: body.trim(), created_at: now(), edited_at: null, like_count: 0, removed: false, mod_reason: null, deleted_at: null };
      db.replies.push(r);
      recount(db, threadId);
      saveLocal(db);
      return r;
    }
    return (await run(sb.from("community_replies").insert({ thread_id: threadId, body: body.trim() }).select(REPLY_COLS).single())) as unknown as Reply;
  },

  async editReply(id: string, body: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      const r = db.replies.find((x) => x.id === id);
      if (r) Object.assign(r, { body: body.trim(), edited_at: now() });
      saveLocal(db);
      return;
    }
    await run(sb.from("community_replies").update({ body: body.trim() }).eq("id", id));
  },

  /** Delete the writer's own thread (replyId null) or reply. */
  async remove(threadId: string, replyId: string | null = null): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      const target = replyId ? db.replies.find((r) => r.id === replyId) : db.threads.find((t) => t.id === threadId);
      if (target) target.deleted_at = now();
      recount(db, threadId);
      saveLocal(db);
      return;
    }
    await run(sb.rpc("community_delete_post", { p_thread: threadId, p_reply: replyId }));
  },

  /** Which of these posts the writer has liked. */
  async liked(ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    const sb = getSupabase();
    if (!sb) return new Set(loadLocal().likes.filter((x) => ids.includes(x)));
    const me = await uid();
    const rows = (await run(sb.from("community_likes").select("target_id").eq("user_id", me).in("target_id", ids))) as { target_id: string }[];
    return new Set((rows ?? []).map((r) => r.target_id));
  },

  async like(targetId: string, kind: "thread" | "reply", on: boolean): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      db.likes = db.likes.filter((x) => x !== targetId);
      if (on) db.likes.push(targetId);
      const post: { like_count: number } | undefined = kind === "thread" ? db.threads.find((t) => t.id === targetId) : db.replies.find((r) => r.id === targetId);
      if (post) post.like_count = Math.max(0, post.like_count + (on ? 1 : -1));
      saveLocal(db);
      return;
    }
    if (on) await run(sb.from("community_likes").insert({ target_id: targetId, target_kind: kind }));
    else await run(sb.from("community_likes").delete().eq("target_id", targetId).eq("user_id", await uid()));
  },

  /** Report a post. Reporting the same post twice is fine (the first report stands). */
  async report(threadId: string, replyId: string | null, reason: ReportReason, note: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      const t = db.threads.find((x) => x.id === threadId);
      const r = replyId ? db.replies.find((x) => x.id === replyId) : null;
      if (!t || db.reports.some((x) => x.reporter === LOCAL_ID && x.thread_id === threadId && x.reply_id === replyId)) return;
      const post = r ?? t;
      db.reports.unshift({
        reporter: LOCAL_ID, id: newId(), created_at: now(), status: "open", reason, note: note.trim() || null,
        thread_id: threadId, thread_title: t.title, thread_status: t.status, reply_id: replyId, excerpt: post.body.slice(0, 280),
        author_id: post.author_id, author_name: post.author_name, reports_on_post: 1, author_banned_until: null,
      });
      saveLocal(db);
      return;
    }
    const { error } = await sb.from("community_reports").insert({ thread_id: threadId, reply_id: replyId, reason, note: note.trim() || null });
    if (error && !/duplicate key/.test(error.message)) throw new CommunityError(problemOf(error), error.message);
  },

  // ── admins ──

  async moderate(action: ModAction, threadId: string, replyId: string | null = null, reason: ModReason | null = null, note = ""): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      const t = db.threads.find((x) => x.id === threadId);
      const r = replyId ? db.replies.find((x) => x.id === replyId) : null;
      if (!t) throw new CommunityError("not_found");
      if (action === "close") Object.assign(t, { status: "closed", mod_reason: reason, mod_note: note || null });
      if (action === "remove") Object.assign(t, { status: "removed", pinned: false, mod_reason: reason, mod_note: note || null });
      if (action === "reopen" || action === "restore") Object.assign(t, { status: "open", mod_reason: null, mod_note: null });
      if (action === "pin" || action === "unpin") t.pinned = action === "pin";
      if (r && (action === "remove_reply" || action === "restore_reply")) Object.assign(r, { removed: action === "remove_reply", mod_reason: action === "remove_reply" ? reason : null });
      if (action === "close" || action === "remove" || action === "remove_reply")
        db.reports.forEach((x) => {
          if (x.thread_id === threadId && (action === "remove_reply" ? x.reply_id === replyId : true) && x.status === "open") x.status = "resolved";
        });
      recount(db, threadId);
      saveLocal(db);
      return;
    }
    await run(sb.rpc("community_moderate", { p_action: action, p_thread: threadId, p_reply: replyId, p_reason: reason, p_note: note || null }));
  },

  /** Bar a writer from posting: days null = until lifted, 0 = lift. */
  async ban(userId: string, days: number | null, reason: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    await run(sb.rpc("community_ban", { p_user: userId, p_days: days, p_reason: reason || null }));
  },

  async queue(status: "open" | "all"): Promise<QueueItem[]> {
    const sb = getSupabase();
    if (!sb) return loadLocal().reports.filter((r) => status === "all" || r.status === "open");
    return ((await run(sb.rpc("community_report_queue", { p_status: status }))) ?? []) as QueueItem[];
  },

  async resolve(reportId: string, status: "resolved" | "dismissed" | "open"): Promise<void> {
    const sb = getSupabase();
    if (!sb) {
      const db = loadLocal();
      const r = db.reports.find((x) => x.id === reportId);
      if (r) r.status = status;
      saveLocal(db);
      return;
    }
    await run(sb.rpc("community_resolve_report", { p_id: reportId, p_status: status }));
  },
};
