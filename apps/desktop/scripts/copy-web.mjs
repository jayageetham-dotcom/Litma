// Copies the desktop build of the web app (apps/web/out, built with an empty base path)
// into apps/desktop/app/web, which electron-builder packs into the installer.
// The dictionary data is not bundled: the app fetches /dict/* from the website on demand.
import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "../../web/out");
const dest = join(here, "../app/web");

if (!existsSync(join(out, "index.html"))) {
  console.error("No web build found. Run:  npm run build:desktop -w @litma/web");
  process.exit(1);
}
if (readFileSync(join(out, "index.html"), "utf8").includes('"/litma/_next/')) {
  console.error("apps/web/out was built for the website (/litma). Rebuild it for the desktop:  npm run build:desktop -w @litma/web");
  process.exit(1);
}
rmSync(dest, { recursive: true, force: true });
// skip only the dictionary data folder (out/dict), not pages that start with "dict" such as out/dictionary
const dictData = join(out, "dict");
cpSync(out, dest, { recursive: true, filter: (src) => src !== dictData && !src.startsWith(dictData + sep) });
console.log("Copied the web app into apps/desktop/app/web");
