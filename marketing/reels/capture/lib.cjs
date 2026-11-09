// Open Litma (a local-mode build, `npm run preview` at the repo root) at phone size.
// Google Fonts is swapped for the same families from npm (Fontsource), so recordings look like the
// real app even where fonts.googleapis.com can't be reached. Run `npm run fonts` once first.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const URL_BASE = process.env.LITMA_URL || "http://localhost:4173";
async function open({ scale = 2.5, w = 432, h = 768 } = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, isMobile: true, hasTouch: true, locale: "en-IN" });
  const css = path.join(__dirname, "google-fonts.css");
  if (fs.existsSync(css)) {
    await ctx.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ contentType: "text/css", body: fs.readFileSync(css, "utf8") }));
    await ctx.route(/\/__fonts\//, (r) => {
      const u = new URL(r.request().url());
      r.fulfill({ contentType: "font/woff2", body: fs.readFileSync(path.join(__dirname, "node_modules", decodeURIComponent(u.pathname.replace("/__fonts/", "")))) });
    });
  }
  const p = await ctx.newPage();
  return { b, ctx, p, url: (route) => URL_BASE + route };
}
// The local-mode note only exists in test builds; signed-in writers never see it.
async function hideLocalNote(p) {
  await p.evaluate(() => {
    for (const el of document.querySelectorAll("div,p"))
      if (/^Local mode/.test(el.textContent?.trim() || "") && el.children.length < 3) el.style.display = "none";
  });
}
module.exports = { open, hideLocalNote };
