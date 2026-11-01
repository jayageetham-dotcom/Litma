// Copies the dependency-free modules in packages/shared/src into supabase/functions/_shared
// so the Edge Functions (Deno) run exactly the same code as the web and desktop apps.
// Works from any directory (the web app's build calls it from apps/web).
import { readdirSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "packages/shared/src");
const to = join(root, "supabase/functions/_shared");
mkdirSync(to, { recursive: true });
for (const f of readdirSync(from).filter((f) => f.endsWith(".ts"))) {
  copyFileSync(join(from, f), join(to, f));
  console.log(`synced ${f}`);
}
