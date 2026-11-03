// Server-side usage events (AI requests, MCP tool calls) for the owner's /admin/ page.
// Lives only in supabase/functions/_shared (not packages/shared): it talks to the database.
// Records what was used, never the text: the AI action name, the MCP tool name, the provider.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

export function recordUsage(db: SupabaseClient, userId: string, name: "ai_request" | "mcp_call", label: string, props: Record<string, string | number | boolean> = {}) {
  // never let analytics slow down or break the real work
  db.from("analytics_events")
    .insert({ user_id: userId, visitor_id: `server:${userId.slice(0, 8)}`, session_id: "server", source: "server", platform: "server", name, label: label.slice(0, 120), props })
    .then(({ error }) => error && console.error("usage", error.message));
}
