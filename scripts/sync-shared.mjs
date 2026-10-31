// Copies dependency-free modules from src/shared into supabase/functions/_shared
// so the Edge Functions (Deno) run exactly the same code as the web app.
import { readdirSync, copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const from = "src/shared";
const to = "supabase/functions/_shared";
mkdirSync(to, { recursive: true });
for (const f of readdirSync(from).filter((f) => f.endsWith(".ts"))) {
  copyFileSync(join(from, f), join(to, f));
  console.log(`synced ${f}`);
}
