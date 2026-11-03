"use client";
/**
 * Litma offline layer (web and desktop).
 *
 *  - A copy of the writer's works, books, Story World, versions and profile is kept on this
 *    device (IndexedDB, per account), refreshed every time the server answers.
 *  - When the server can't be reached, `store` reads that copy and puts every change in an
 *    outbox here. The outbox is sent in order as soon as the connection is back (the `online`
 *    event, app start, and every 30 s while anything waits).
 *  - A change to a work that was also edited elsewhere while this device was offline keeps
 *    the other copy as a version ("Before offline changes") before saving over it.
 *
 * Local mode (no Supabase) never uses this: everything already lives in localStorage there.
 */
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "./supabase/client";

const DB_NAME = "litma-offline";
const ROWS = "rows";
const OUTBOX = "outbox";
const LS_USER = "litma:offline-user";
export const SYNC_EVENT = "litma:sync";
const RETRY_MS = 30_000;
/** label of the version that keeps the server's copy when offline changes save over newer text */
export const CONFLICT_LABEL = "Before offline changes";

// ── errors ──

/** The server couldn't be reached (no network, DNS, dropped connection). */
export class OfflineError extends Error {
  readonly offline = true;
  constructor() {
    super("Offline");
  }
}

const browserOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;

export function isNetworkError(e: unknown, status?: number): boolean {
  if (e instanceof OfflineError) return true;
  if (browserOffline() || status === 0) return true;
  const err = e as { name?: string; message?: string } | null;
  if (err?.name === "AuthRetryableFetchError") return true;
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|err_internet|err_name|err_connection|err_network|err_timed_out/i.test(err?.message ?? String(e ?? ""));
}

type Result<T> = { data: T; error: unknown; status?: number };

/**
 * The server didn't answer the last request (network up, but no internet, DNS or server down).
 * While set, app requests go straight to the device copy; the sync loop keeps probing and clears it.
 */
let serverDown = false;
const setServerDown = (down: boolean) => {
  if (serverDown === down) return;
  serverDown = down;
  emit();
};
/** Offline for the app's purposes: the browser says so, or the server stopped answering. */
export const isOfflineNow = () => browserOffline() || serverDown;

/** A refresh of an expired session retries for up to 30 s when the server is unreachable: don't wait that long. */
const TIME_LIMIT = 8_000;

/**
 * Await a Supabase query. Throws OfflineError when the server can't be reached (without sending
 * anything when the app already knows it is offline), the query's own error otherwise.
 */
export async function remote<T>(query: PromiseLike<Result<T>>, opts: { probe?: boolean } = {}): Promise<T> {
  // probe: the sync loop finding out whether the server answers again (sent even while serverDown)
  const probing = !!opts.probe;
  if (browserOffline() || (serverDown && !probing)) throw new OfflineError();
  // every query first reads the session; an expired one is refreshed, which hangs while the server is unreachable
  const sb = getSupabase();
  if (sb && !probing) {
    const ready = await Promise.race([sb.auth.getSession().then(() => true, () => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 2500))]);
    if (!ready) {
      setServerDown(true);
      throw new OfflineError();
    }
  }
  let r: Result<T>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    r = await Promise.race([
      Promise.resolve(query),
      new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new OfflineError()), TIME_LIMIT))),
    ]);
  } catch (e) {
    if (isNetworkError(e)) {
      setServerDown(true);
      throw new OfflineError();
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (r.error) {
    if (isNetworkError(r.error, r.status)) {
      setServerDown(true);
      throw new OfflineError();
    }
    const pe = r.error as { message?: string; code?: string };
    setServerDown(false);
    throw Object.assign(new Error(pe.message ?? "Request failed"), { code: pe.code, status: r.status });
  }
  setServerDown(false);
  return r.data;
}

// ── the signed-in writer, remembered for offline starts ──

let remembered: Pick<User, "id" | "email" | "app_metadata" | "user_metadata" | "aud" | "created_at"> | null | undefined;

export function rememberUser(u: User | null) {
  remembered = u ? { id: u.id, email: u.email, app_metadata: u.app_metadata, user_metadata: u.user_metadata, aud: u.aud, created_at: u.created_at } : null;
  try {
    if (u) localStorage.setItem(LS_USER, JSON.stringify(remembered));
    else localStorage.removeItem(LS_USER);
  } catch {}
}

/** The writer who last signed in on this device (used when the session can't be refreshed offline). */
export function rememberedUser(): User | null {
  if (remembered === undefined) {
    try {
      const raw = localStorage.getItem(LS_USER);
      remembered = raw ? JSON.parse(raw) : null;
    } catch {
      remembered = null;
    }
  }
  return (remembered as User | null) ?? null;
}

async function uid(): Promise<string | null> {
  const known = rememberedUser()?.id;
  if (known) return known;
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    if (data.session) {
      rememberUser(data.session.user);
      return data.session.user.id;
    }
  } catch {}
  return null;
}

/**
 * The signed-in writer. When the session can't be read quickly (an expired token being refreshed
 * against an unreachable server), the writer remembered on this device.
 */
export async function currentUser(): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const fallback = rememberedUser();
  const read = sb.auth
    .getSession()
    .then(({ data }) => {
      if (data.session) rememberUser(data.session.user);
      return data.session?.user ?? fallback;
    })
    .catch(() => fallback);
  if (!fallback) return read;
  return Promise.race([read, new Promise<User | null>((resolve) => setTimeout(() => resolve(fallback), 1500))]);
}

// ── IndexedDB ──

let dbPromise: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  dbPromise ??= new Promise((resolve) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore(ROWS);
        r.result.createObjectStore(OUTBOX, { keyPath: "key", autoIncrement: true });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** Run one request in its own transaction; resolves once the transaction has committed. */
async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise<T | undefined>((resolve, reject) => {
    const t = d.transaction(store, mode);
    let value: T | undefined;
    const r = fn(t.objectStore(store));
    r.onsuccess = () => (value = r.result);
    t.oncomplete = () => resolve(value);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const rowKey = (u: string, table: string, id: string) => `${u}|${table}|${id}`;

/** Rows kept on this device. Each row may carry `_server_at`: its updated_at when the server last sent it. */
export const cache = {
  async get<T>(table: string, id: string): Promise<T | null> {
    const u = await uid();
    if (!u) return null;
    return ((await run(ROWS, "readonly", (s) => s.get(rowKey(u, table, id))).catch(() => undefined)) as T | undefined) ?? null;
  },

  async put(table: string, id: string, row: unknown) {
    const u = await uid();
    if (!u) return;
    await run(ROWS, "readwrite", (s) => s.put(row, rowKey(u, table, id))).catch(() => {});
  },

  /** Merge fields into a kept row (creates it when missing). */
  async merge<T extends object>(table: string, id: string, patch: Partial<T>): Promise<T> {
    const old = (await this.get<T>(table, id)) ?? ({} as T);
    const row = { ...old, ...patch } as T;
    await this.put(table, id, row);
    return row;
  },

  async remove(table: string, id: string) {
    const u = await uid();
    if (!u) return;
    await run(ROWS, "readwrite", (s) => s.delete(rowKey(u, table, id))).catch(() => {});
  },

  async all<T>(table: string): Promise<T[]> {
    const u = await uid();
    if (!u) return [];
    const prefix = rowKey(u, table, "");
    return ((await run(ROWS, "readonly", (s) => s.getAll(IDBKeyRange.bound(prefix, prefix + "￿"))).catch(() => undefined)) as T[] | undefined) ?? [];
  },
};

// ── outbox ──

export type Op =
  | { kind: "insert"; table: string; id: string; row: Record<string, unknown> }
  | { kind: "update"; table: string; id: string; patch: Record<string, unknown>; base?: string | null }
  | { kind: "upsert"; table: string; id: string; row: Record<string, unknown>; onConflict?: string }
  | { kind: "delete"; table: string; id?: string; match?: Record<string, string> }
  | { kind: "rpc"; fn: string; args: Record<string, number> };

type Queued = Op & { key?: number; uid: string; at: string; tries?: number };

let inflight: number | null = null;

async function queued(u: string): Promise<Queued[]> {
  const all = ((await run(OUTBOX, "readonly", (s) => s.getAll()).catch(() => undefined)) as Queued[] | undefined) ?? [];
  return all.filter((o) => o.uid === u).sort((a, b) => (a.key ?? 0) - (b.key ?? 0));
}

const sameRow = (o: Queued, table: string, id?: string) => "table" in o && o.table === table && "id" in o && !!id && o.id === id;

/** Put a change in the outbox (merged into an earlier waiting change to the same row when possible). */
export async function enqueue(op: Op) {
  const u = await uid();
  if (!u || !(await db())) throw new OfflineError();
  const list = (await queued(u)).filter((o) => o.key !== inflight);
  const at = new Date().toISOString();
  const save = (o: Queued) => run(OUTBOX, "readwrite", (s) => s.put(o));
  const drop = (o: Queued) => run(OUTBOX, "readwrite", (s) => s.delete(o.key!));

  if (op.kind === "update") {
    const last = [...list].reverse().find((o) => sameRow(o, op.table, op.id));
    if (last?.kind === "insert" || last?.kind === "upsert") {
      await save({ ...last, row: { ...last.row, ...op.patch } });
      return notify();
    }
    if (last?.kind === "update") {
      await save({ ...last, patch: { ...last.patch, ...op.patch } });
      return notify();
    }
  } else if (op.kind === "delete" && op.id) {
    const mine = list.filter((o) => sameRow(o, op.table, op.id));
    for (const o of mine) await drop(o);
    // created while offline and never sent: nothing to delete on the server
    if (mine.some((o) => o.kind === "insert")) return notify();
  } else if (op.kind === "rpc") {
    const same = list.find((o) => o.kind === "rpc" && o.fn === op.fn);
    if (same && same.kind === "rpc") {
      const args = { ...same.args };
      for (const [k, v] of Object.entries(op.args)) args[k] = (args[k] ?? 0) + v;
      await save({ ...same, args });
      return notify();
    }
  }
  await run(OUTBOX, "readwrite", (s) => s.add({ ...op, uid: u, at } as Queued));
  notify();
}

/** Changes made on this device that the server doesn't have yet. */
export async function pendingCount(): Promise<number> {
  const u = await uid();
  return u ? (await queued(u)).length : 0;
}

/** True when a row still has an unsent change (so a server listing that lacks it is out of date). */
export async function hasPending(table: string, id: string): Promise<boolean> {
  const u = await uid();
  return !!u && (await queued(u)).some((o) => sameRow(o, table, id));
}

export type SyncState = { pending: number; syncing: boolean; offline: boolean };

/** Tell the app how many changes wait (OfflineStatus, the editor's save line). */
function emit() {
  if (typeof window === "undefined") return;
  pendingCount()
    .then((pending) => window.dispatchEvent(new CustomEvent<SyncState>(SYNC_EVENT, { detail: { pending, syncing: !!syncing, offline: isOfflineNow() } })))
    .catch(() => {});
}

let soon: ReturnType<typeof setTimeout> | null = null;
/** A change was queued: emit, and try to send it shortly (it may only have been a dropped request). */
function notify() {
  emit();
  if (typeof window === "undefined" || soon) return;
  soon = setTimeout(() => {
    soon = null;
    void sync();
  }, 1500);
}

const retryable = (e: unknown) => {
  if (e instanceof OfflineError) return true;
  const s = (e as { status?: number })?.status ?? 0;
  return s === 401 || s === 408 || s === 429 || s >= 500;
};

/** requests from the sync loop probe the server even while it is marked unreachable */
const P = { probe: true };

async function send(sb: SupabaseClient, op: Queued) {
  switch (op.kind) {
    case "insert": {
      try {
        await remote(sb.from(op.table).insert(op.row), P);
      } catch (e) {
        // already there (an earlier attempt reached the server but its answer was lost)
        if ((e as { code?: string }).code !== "23505") throw e;
        const { id: _id, ...rest } = op.row;
        void _id;
        await remote(sb.from(op.table).update(rest).eq("id", op.id), P);
      }
      if (op.table === "documents") await markServer(sb, op.id, true, null, P);
      return;
    }
    case "update": {
      if (op.table === "documents" && "content" in op.patch && op.base) await keepNewerServerCopy(sb, op.id, op.base);
      if (op.table !== "documents") {
        await remote(sb.from(op.table).update(op.patch).eq("id", op.id), P);
        return;
      }
      const row = (await remote(sb.from("documents").update(op.patch).eq("id", op.id).select("updated_at").maybeSingle(), P)) as { updated_at: string } | null;
      await markServer(sb, op.id, "content" in op.patch, row?.updated_at, P);
      return;
    }
    case "upsert":
      await remote(sb.from(op.table).upsert(op.row, op.onConflict ? { onConflict: op.onConflict } : undefined), P);
      return;
    case "delete":
      if (op.id) await remote(sb.from(op.table).delete().eq("id", op.id), P);
      else if (op.match) await remote(sb.from(op.table).delete().match(op.match), P);
      return;
    case "rpc":
      await remote(sb.rpc(op.fn, op.args), P);
      return;
  }
}

/** The work changed elsewhere after this device last saw it: keep that text as a version before saving over it. */
async function keepNewerServerCopy(sb: SupabaseClient, id: string, base: string) {
  const server = await remote(sb.from("documents").select("updated_at,content,word_count").eq("id", id).maybeSingle(), P);
  const row = server as { updated_at: string; content: unknown; word_count: number } | null;
  if (!row || Date.parse(row.updated_at) <= Date.parse(base)) return;
  await remote(sb.from("document_versions").insert({ document_id: id, content: row.content, word_count: row.word_count, label: CONFLICT_LABEL }), P);
}

/**
 * Note the server's updated_at for a work after a save, so the next offline edit knows what it was
 * based on (`withContent`: the save carried the text, so the text kept here now matches the server).
 */
export async function markServer(sb: SupabaseClient, id: string, withContent: boolean, updatedAt?: string | null, opts: { probe?: boolean } = {}) {
  try {
    const at = updatedAt ?? ((await remote(sb.from("documents").select("updated_at").eq("id", id).maybeSingle(), opts)) as { updated_at: string } | null)?.updated_at;
    if (!at || !(await cache.get("documents", id))) return;
    await cache.merge("documents", id, { _server_at: at, updated_at: at, ...(withContent ? { _content_at: at } : {}) } as Record<string, unknown>);
  } catch {
    /* only bookkeeping */
  }
}

let syncing: Promise<boolean> | null = null;

/** Send the outbox. Resolves true when nothing is left waiting. */
let syncStartedAt = 0;

export function sync(): Promise<boolean> {
  if (syncing) return syncing;
  syncStartedAt = Date.now();
  syncing = (async () => {
    const sb = getSupabase();
    const u = await uid();
    if (!sb || !u) return true;
    if (browserOffline()) return (await queued(u)).length === 0;
    for (;;) {
      const [op] = await queued(u);
      if (!op) {
        // nothing to send: still find out whether the server answers again
        if (serverDown) await remote(sb.from("profiles").select("id").limit(1), P).catch(() => {});
        return !serverDown;
      }
      inflight = op.key ?? null;
      try {
        await send(sb, op);
        await run(OUTBOX, "readwrite", (s) => s.delete(op.key!));
      } catch (e) {
        if (retryable(e)) return false;
        // the server refused this change: keep it on the device (never thrown away) and move on
        console.warn("Litma: a change could not be synced", op, e);
        const tries = (op.tries ?? 0) + 1;
        if (tries < 3) {
          await run(OUTBOX, "readwrite", (s) => s.put({ ...op, tries }));
          return false;
        }
        await cache.put("failed", String(op.key), { ...op, error: String((e as Error)?.message ?? e) });
        await run(OUTBOX, "readwrite", (s) => s.delete(op.key!));
      } finally {
        inflight = null;
      }
    }
  })()
    .catch(() => false)
    .finally(() => {
      syncing = null;
      emit();
    });
  emit();
  return syncing;
}

/** Try the outbox first; true when the server is up to date with this device. */
export async function syncFirst(): Promise<boolean> {
  if (browserOffline()) return false;
  if (serverDown) {
    void sync(); // probe in the background; this call uses the device copy
    return false;
  }
  if ((await pendingCount()) === 0) return true;
  // don't hold the app up for long: 3 s after a sync started, the app reads the device copy while it carries on
  const running = sync();
  const left = 3000 - (Date.now() - syncStartedAt);
  if (left <= 0) return false;
  return Promise.race([running, new Promise<boolean>((resolve) => setTimeout(() => resolve(false), left))]);
}

/** Start syncing in the background: on start, when the connection returns, and every 30 s while changes wait. */
let started = false;
export function startSync() {
  if (started || typeof window === "undefined" || !getSupabase()) return;
  started = true;
  const kick = () => void sync();
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && kick());
  setInterval(async () => {
    if (serverDown || (await pendingCount()) > 0) kick();
  }, RETRY_MS);
  kick();
}
