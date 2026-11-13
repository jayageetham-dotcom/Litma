/**
 * POST /functions/v1/litma-account: the writer's own account. Requires a signed-in user.
 *
 *   { op: "delete", confirm: "DELETE" }  →  { deleted: true }
 *
 * Deletes the account for good: every row that belongs to it goes with the auth user (all of
 * Litma's tables reference auth.users with ON DELETE CASCADE: works, versions, books, Story World,
 * saved words, AI keys, assistant tokens, goals and statistics, community posts), and the writer's
 * pictures are removed from storage first. Used by Settings → Delete account on the web, desktop
 * and phone apps (App Store and Google Play ask for deletion inside the app).
 */
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { json, preflight } from "../_shared/cors.ts";
import { hit, tooMany } from "../_shared/ratelimit.ts";
import { deleteAccount } from "../_shared/accounts.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data } = await db.auth.getUser(token);
  const id = data.user?.id;
  if (!id) return json({ error: "Sign in first." }, 401);
  const wait = hit("account", id, 5, 600);
  if (wait) return tooMany(wait);

  let b: Record<string, unknown> = {};
  try {
    b = await req.json();
  } catch {
    /* handled below */
  }
  if (b.op !== "delete") return json({ error: "Unknown action" }, 400);
  if (b.confirm !== "DELETE") return json({ error: "Type DELETE to confirm." }, 400);

  const error = await deleteAccount(db, id);
  if (error) {
    console.error("litma-account: delete", error);
    return json({ error: "Your account couldn't be deleted just now. Please try again, or write to support@getlitma.in." }, 500);
  }
  console.log("litma-account: deleted an account");
  return json({ deleted: true });
});
