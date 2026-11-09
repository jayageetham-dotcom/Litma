// The real first page of each writing type, from the home page's showcase (TemplatePreview), at 4x.
const { open } = require("./lib.cjs");
const fs = require("fs"), path = require("path");
(async () => {
  const { b, p, url } = await open({ scale: 4, w: 432, h: 900 });
  await p.goto(url("/")); await p.waitForTimeout(2500);
  const out = path.join(__dirname, "../reel-types/public/pages"); fs.mkdirSync(out, { recursive: true });
  const tabs = p.getByRole("tab"); const n = await tabs.count();
  for (let i = 0; i < n; i++) {
    const t = tabs.nth(i); await t.scrollIntoViewIfNeeded(); await t.click(); await p.waitForTimeout(700);
    const pv = p.locator(".tpl-preview").first(); await pv.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
    await pv.screenshot({ path: path.join(out, `${i}.png`) });
  }
  console.log(`${n} pages in ${out}`); await b.close();
})();
