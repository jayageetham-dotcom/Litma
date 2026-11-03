// Serve the static export (out/) at http://localhost:4173/ — like the live site.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json", ".txt": "text/plain", ".woff2": "font/woff2", ".png": "image/png" };

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://x");
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(302, { location: `${BASE}/` }).end();
    return;
  }
  let p = normalize(join("out", decodeURIComponent(url.pathname.slice(BASE.length))));
  try {
    if ((await stat(p)).isDirectory()) p = join(p, "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(p)] ?? "application/octet-stream" }).end(await readFile(p));
  } catch {
    res.writeHead(404, { "content-type": "text/html" }).end(await readFile("out/404.html").catch(() => "Not found"));
  }
}).listen(4173, () => console.log(`Litma preview → http://localhost:4173${BASE}/`));
