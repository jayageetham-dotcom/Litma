// After `next build`: writes apps/web/out/version.json with the version and build id of this build
// (same rule as apps/web/next.config.ts: version + git commit). Open tabs poll it
// (components/UpdateNotice.tsx) and offer a reload when a newer build is live.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = process.env.LITMA_VERSION || JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
let commit = "local";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
} catch {
  /* not a git checkout */
}
const build = process.env.LITMA_BUILD_ID || `${version}+${commit}`;
writeFileSync(join(root, "apps/web/out/version.json"), JSON.stringify({ version, build, date: new Date().toISOString(), ...(process.env.NEXT_PUBLIC_DESKTOP === "1" ? { desktop: true } : {}) }, null, 2) + "\n");
console.log(`version.json → ${build}`);
