import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/config";

/** URL prefix the app is served under (e.g. "/litma"). */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
/** Public URL of the app, without trailing slash. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
/** Litma's MCP endpoint (PHP proxy on the website → Supabase Edge Function). */
export const MCP_URL = SITE_URL ? `${SITE_URL}/mcp` : `${SUPABASE_URL}/functions/v1/litma-mcp`;
/**
 * Direct Edge Function address. Cloud-hosted connectors (Claude.ai, ChatGPT) call from data centres,
 * which the shared web host's firewall blocks, so they use this one. The project URL is already public
 * (it ships in the app bundle); every MCP call still needs the writer's own Litma token.
 */
export const MCP_DIRECT_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/litma-mcp` : MCP_URL;
export const FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : "";

/** Absolute in-app URL for the current origin (handles the base path). */
export function appUrl(path: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${BASE}${path}`;
}

export const anonHeaders = (): Record<string, string> => (SUPABASE_ANON_KEY ? { apikey: SUPABASE_ANON_KEY } : {});
