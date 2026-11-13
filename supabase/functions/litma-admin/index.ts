/**
 * POST /functions/v1/litma-admin: reports for the owner's /admin/ page. Requires a signed-in user
 * who is listed in app_admins; everyone else gets 403.
 *
 *   { op: "check" }                                  → { admin: true }
 *   { op: "dashboard", days?: 7..90, includeAdmins? } → overview, audience and behaviour numbers
 *   { op: "users", includeAdmins? }                  → every account with usage counts (no writing)
 *   { op: "user", id }                               → one person's devices, daily activity and latest events
 *                                                      (+ account: { banned_until }, actions: the moderation log)
 *   { op: "block", id, days: 1..36500, reason? }     → blocks sign-in for that many days (36500 = for good)
 *   { op: "unblock", id }                            → lifts a block
 *   { op: "delete", id, confirm: <their email or id>, reason? } → deletes the account and everything in it
 * Admins can't block or delete themselves or another admin. Every action goes to admin_actions.
 */
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { json, preflight } from "../_shared/cors.ts";
import { deleteAccount } from "../_shared/accounts.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const db = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

async function adminId(req: Request): Promise<string | null> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await db.auth.getUser(token);
  const id = data.user?.id;
  if (!id) return null;
  const { data: row } = await db.from("app_admins").select("user_id").eq("user_id", id).maybeSingle();
  return row ? id : null;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const id = await adminId(req).catch(() => null);
  if (!id) return json({ admin: false, error: "Not an admin" }, 403);

  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {
    /* empty body = check */
  }
  const op = String(b.op ?? "check");
  const exclude = b.includeAdmins !== true;

  if (op === "check") return json({ admin: true });
  if (op === "dashboard") {
    const days = Math.min(90, Math.max(1, Math.round(Number(b.days) || 30)));
    const { data, error } = await db.rpc("admin_dashboard", { p_days: days, p_exclude_admins: exclude });
    return error ? json({ error: error.message }, 500) : json(data);
  }
  if (op === "users") {
    const { data, error } = await db.rpc("admin_users", { p_exclude_admins: exclude });
    return error ? json({ error: error.message }, 500) : json(data);
  }
  if (op === "user") {
    const uid = String(b.id ?? "");
    if (!/^[0-9a-f-]{36}$/.test(uid)) return json({ error: "Bad id" }, 400);
    const { data, error } = await db.rpc("admin_user_activity", { p_user: uid, p_limit: 300 });
    if (error) return json({ error: error.message }, 500);
    const { data: who } = await db.auth.admin.getUserById(uid);
    const until = (who.user as { banned_until?: string } | null)?.banned_until ?? null;
    const { data: actions } = await db.from("admin_actions").select("created_at, action, days, reason").eq("target_id", uid).order("created_at", { ascending: false }).limit(20);
    return json({ ...data, account: { banned_until: until && new Date(until) > new Date() ? until : null }, actions: actions ?? [] });
  }
  if (op === "block" || op === "unblock" || op === "delete") {
    const uid = String(b.id ?? "");
    if (!/^[0-9a-f-]{36}$/.test(uid)) return json({ error: "Bad id" }, 400);
    if (uid === id) return json({ error: "You can't do this to your own account." }, 400);
    const { data: other } = await db.from("app_admins").select("user_id").eq("user_id", uid).maybeSingle();
    if (other) return json({ error: "This is an admin account. Remove it from app_admins first." }, 400);
    const { data: who, error: whoErr } = await db.auth.admin.getUserById(uid);
    if (whoErr || !who.user) return json({ error: "No such account." }, 404);
    const reason = typeof b.reason === "string" ? b.reason.trim().slice(0, 500) || null : null;
    const log = (action: string, days: number | null = null) => db.from("admin_actions").insert({ admin_id: id, target_id: uid, action, days, reason });

    if (op === "block") {
      const days = Math.round(Number(b.days));
      if (!(days >= 1 && days <= 36500)) return json({ error: "Days must be between 1 and 36500." }, 400);
      // Supabase Auth refuses sign-in and token refresh until then; the current session ends within the hour
      const { error } = await db.auth.admin.updateUserById(uid, { ban_duration: `${days * 24}h` });
      if (error) return json({ error: error.message }, 500);
      await log("block", days);
      const { data: after } = await db.auth.admin.getUserById(uid);
      return json({ ok: true, banned_until: (after.user as { banned_until?: string } | null)?.banned_until ?? null });
    }
    if (op === "unblock") {
      const { error } = await db.auth.admin.updateUserById(uid, { ban_duration: "none" });
      if (error) return json({ error: error.message }, 500);
      await log("unblock");
      return json({ ok: true, banned_until: null });
    }
    // delete: the admin types the account's email (or its id when it has none) to confirm
    const expect = (who.user.email ?? uid).toLowerCase();
    if (String(b.confirm ?? "").trim().toLowerCase() !== expect) return json({ error: "Type the account's email to confirm." }, 400);
    await log("delete");
    const err = await deleteAccount(db, uid);
    if (err) return json({ error: err }, 500);
    return json({ ok: true, deleted: true });
  }
  return json({ error: "Unknown op" }, 400);
});
