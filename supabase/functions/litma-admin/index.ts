/**
 * POST /functions/v1/litma-admin: reports for the owner's /admin/ page. Requires a signed-in user
 * who is listed in app_admins; everyone else gets 403.
 *
 *   { op: "check" }                                  → { admin: true }
 *   { op: "dashboard", days?: 7..365, includeAdmins? } → overview, audience and behaviour numbers
 *   { op: "users", includeAdmins? }                  → every account with usage counts (no writing)
 *   { op: "user", id }                               → one person's devices, daily activity and latest events
 */
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { json, preflight } from "../_shared/cors.ts";

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
    const days = Math.min(365, Math.max(1, Math.round(Number(b.days) || 30)));
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
    return error ? json({ error: error.message }, 500) : json(data);
  }
  return json({ error: "Unknown op" }, 400);
});
