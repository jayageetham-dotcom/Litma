// Footage for the 30 s launch reel (../reel-launch): the real app in dark mode, phone size
// 390 x 798 CSS px at 3x (1170 x 2394), shown inside a phone frame in the reel; plus one desktop clip.
// Run with the local-mode preview at http://localhost:4173. `node rec-launch.cjs [shot…]`
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { human, rng } = require("./rec.cjs");
const BASE = process.env.LITMA_URL || "http://localhost:4173";
const OUT = path.join(__dirname, "../reel-launch/assets");
const css = path.join(__dirname, "google-fonts.css");

async function open({ w = 390, h = 798, scale = 3, mobile = true } = {}) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale, isMobile: mobile, hasTouch: mobile, locale: "en-IN", colorScheme: "dark" });
  await ctx.addInitScript(() => { try { localStorage.setItem("litma:theme", "dark"); } catch {} });
  if (fs.existsSync(css)) {
    await ctx.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ contentType: "text/css", body: fs.readFileSync(css, "utf8") }));
    await ctx.route(/\/__fonts\//, (r) => { const u = new URL(r.request().url());
      r.fulfill({ contentType: "font/woff2", body: fs.readFileSync(path.join(__dirname, "node_modules", decodeURIComponent(u.pathname.replace("/__fonts/", "")))) }); });
  }
  const p = await ctx.newPage();
  return { b, p, url: (r) => BASE + r, W: w * scale, H: h * scale };
}

// CDP screencast at full device pixels, re-timed to 30 fps CFR.
async function recorder(p, name, W, H) {
  const dir = path.join(__dirname, ".frames", name); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const s = await p.context().newCDPSession(p); const frames = []; let t0 = null;
  s.on("Page.screencastFrame", async (f) => { const t = f.metadata.timestamp; if (t0 === null) t0 = t;
    fs.writeFileSync(path.join(dir, `${String(frames.length).padStart(5, "0")}.jpg`), Buffer.from(f.data, "base64")); frames.push(t - t0);
    s.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
  await s.send("Page.startScreencast", { format: "jpeg", quality: 96, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const marks = [];
  return {
    mark: (label) => marks.push({ t: t0 === null ? 0 : +(Date.now() / 1000 - t0).toFixed(2), label }),
    async stop() {
      await new Promise((r) => setTimeout(r, 600)); await s.send("Page.stopScreencast");
      const lines = []; for (let i = 0; i < frames.length; i++) { const d = (frames[i + 1] ?? frames[i] + 0.5) - frames[i];
        lines.push(`file '${dir}/${String(i).padStart(5, "0")}.jpg'`, `duration ${Math.max(d, 0.001).toFixed(4)}`); }
      lines.push(`file '${dir}/${String(frames.length - 1).padStart(5, "0")}.jpg'`);
      const list = dir + ".txt"; fs.writeFileSync(list, lines.join("\n"));
      const out = path.join(OUT, `${name}.mp4`);
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-vf", `fps=30,scale=${W}:${H}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-crf", "10", "-preset", "slow", out]);
      fs.writeFileSync(path.join(OUT, `${name}.marks.json`), JSON.stringify(marks, null, 1));
      console.log(name, frames.length, "frames", frames.at(-1)?.toFixed(1), "s", marks.map((m) => m.label + "@" + m.t).join(" "));
    },
  };
}
const tap = async (p, loc) => { const bb = await loc.boundingBox(); await p.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2); };
const glide = (p, sel, dist, ms) => p.evaluate(([sel, dist, ms]) => new Promise((r) => {
  const sc = sel ? document.querySelector(sel) : document.scrollingElement; const s = sc.scrollTop, t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); sc.scrollTop = s + dist * (1 - Math.pow(1 - k, 3)); k < 1 ? requestAnimationFrame(f) : r(); };
  requestAnimationFrame(f); }), [sel, dist, ms]);
async function newStory(p, url) {
  await p.goto(url("/desk/")); await p.waitForTimeout(1500);
  await p.getByRole("button", { name: "New work" }).last().click(); await p.waitForTimeout(800);
  await p.getByText("ചെറുകഥ", { exact: false }).first().click(); await p.waitForTimeout(2500);
}

const SHOTS = {
  // Manglish typed, Malayalam appears.
  async write() {
    const { b, p, url, W, H } = await open(); const r = rng(11);
    await newStory(p, url);
    const rec = await recorder(p, "write", W, H); await p.waitForTimeout(900);
    await tap(p, p.locator(".ProseMirror > *").first()); await p.waitForTimeout(600);
    rec.mark("title"); await human(p, "nilaavuLLa raathri", r, { base: 105 }); await p.waitForTimeout(450);
    await p.keyboard.press("Enter"); await p.waitForTimeout(500);
    rec.mark("author"); await human(p, "rasiya ", r, { base: 110 }); await p.keyboard.press("Enter"); await p.waitForTimeout(600);
    rec.mark("body"); await human(p, "puRaththu nilaavu peythirunnu. ", r, { base: 80 });
    rec.mark("body2"); await human(p, "aayisha jaalakam thuRannu. ", r, { base: 75 });
    await p.waitForTimeout(1200); rec.mark("end");
    console.log(await p.locator(".ProseMirror").first().innerText());
    await rec.stop(); await b.close();
  },
  // Desk → New work → the writing-type picker.
  async picker() {
    const { b, p, url, W, H } = await open();
    await p.goto(url("/desk/")); await p.waitForTimeout(2000);
    await require("./lib.cjs").hideLocalNote(p); await p.waitForTimeout(300);
    const rec = await recorder(p, "picker", W, H); await p.waitForTimeout(800);
    rec.mark("tap"); await tap(p, p.getByRole("button", { name: "New work" }).last()); await p.waitForTimeout(1200);
    rec.mark("flick");
    await p.evaluate(async () => { const d = document.querySelector(".dialog"); const sc = [d, ...d.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY != "visible");
      const flick = (dist, ms) => new Promise((r) => { const s = sc.scrollTop, t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / ms); sc.scrollTop = s + dist * (1 - Math.pow(1 - k, 3)); k < 1 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
      await flick(650, 650); await new Promise((r) => setTimeout(r, 400)); await flick(800, 700); await new Promise((r) => setTimeout(r, 400)); await flick(900, 800); });
    await p.waitForTimeout(900); rec.mark("end"); await rec.stop(); await b.close();
  },
  // Dictionary: look up നിലാവ്, then its rhymes.
  async dict() {
    const { b, p, url, W, H } = await open(); const r = rng(5);
    await p.goto(url("/dictionary/")); await p.waitForTimeout(2200);
    const rec = await recorder(p, "dict", W, H); await p.waitForTimeout(700);
    const box = p.getByPlaceholder(/word/i).first(); await tap(p, box); await p.waitForTimeout(400);
    rec.mark("type"); await human(p, "nilaav", r, { base: 120 }); await p.waitForTimeout(500); await p.keyboard.press("Enter"); await p.waitForTimeout(1200);
    const chip = p.locator("button", { hasText: /^നിലാവ്$/ }).first();
    if (await chip.count()) { rec.mark("chip"); await tap(p, chip); await p.waitForTimeout(1600); }
    await p.evaluate(() => document.activeElement?.blur());
    rec.mark("entry"); await glide(p, null, 260, 900); await p.waitForTimeout(1500);
    await glide(p, null, -260, 500); await p.waitForTimeout(300);
    rec.mark("rhymes"); await tap(p, p.getByRole("tab", { name: "പ്രാസം", exact: true })); await p.waitForTimeout(900);
    await tap(p, p.getByPlaceholder(/A word or a line/).first()); await human(p, "nilaav", r, { base: 110 }); await p.keyboard.press("Enter"); await p.waitForTimeout(1300);
    await p.evaluate(() => document.activeElement?.blur()); rec.mark("rhymelist");
    await glide(p, null, 330, 900); await p.waitForTimeout(1600); rec.mark("end");
    await rec.stop(); await b.close();
  },
  // Story World: two characters already there, a third is added.
  async world() {
    const { b, p, url, W, H } = await open();
    await newStory(p, url);
    await tap(p, p.locator(".ProseMirror > *").first()); await p.keyboard.type("nilaavuLLa raathri ", { delay: 20 });
    await tap(p, p.getByRole("button", { name: "Hide keyboard" })); await p.waitForTimeout(700);
    await tap(p, p.getByRole("button", { name: "Story", exact: true })); await p.waitForTimeout(800);
    await tap(p, p.getByRole("button", { name: "Open Story World" })); await p.waitForTimeout(1800);
    const add = async (name, line) => {
      await tap(p, p.getByRole("button", { name: "Add character" })); await p.waitForTimeout(900);
      const f = p.locator(".dialog input, input").filter({ hasNot: p.locator("[placeholder]") });
      const name1 = p.getByText("Name", { exact: true }).locator("xpath=following::input[1]"); await name1.fill(name);
      const desc = p.getByText("Name", { exact: true }).locator("xpath=following::textarea[1]"); await desc.fill(line);
      await p.getByRole("button", { name: "Done" }).click(); await p.waitForTimeout(900);
    };
    await add("ജോസഫ്", "പഴയ വായനശാലയുടെ കാവൽക്കാരൻ");
    await add("മീനാക്ഷി", "ആയിഷയുടെ കൂട്ടുകാരി, കവിത എഴുതും");
    await p.waitForTimeout(800);
    const rec = await recorder(p, "world", W, H); await p.waitForTimeout(1200);
    rec.mark("add"); await tap(p, p.getByRole("button", { name: "Add character" })); await p.waitForTimeout(900);
    const name1 = p.getByText("Name", { exact: true }).locator("xpath=following::input[1]"); await tap(p, name1);
    rec.mark("name"); for (const c of ["ആ", "യി", "ഷ"]) { await p.keyboard.insertText(c); await p.waitForTimeout(220); }
    await p.waitForTimeout(400);
    const desc = p.getByText("Name", { exact: true }).locator("xpath=following::textarea[1]"); await tap(p, desc);
    rec.mark("desc"); for (const w of "ജാലകം തുറന്ന് നിലാവ് കാണുന്ന പെൺകുട്ടി".split(" ")) { await p.keyboard.insertText(w + " "); await p.waitForTimeout(260); }
    await p.waitForTimeout(600);
    rec.mark("done"); await p.getByRole("button", { name: "Done" }).evaluate((e) => e.click()); await p.waitForTimeout(2200); rec.mark("end");
    await rec.stop(); await b.close();
  },
  // Book: the cover changes through three presets.
  async cover() {
    const { b, p, url, W, H } = await open();
    await p.goto(url("/desk/?view=books")); await p.waitForTimeout(2000);
    await p.getByRole("button", { name: /New book/ }).last().click(); await p.waitForTimeout(2500);
    const t = p.getByPlaceholder("Book title").or(p.getByLabel("Book title")).first();
    await t.fill("നിലാവുള്ള രാത്രി"); await t.press("Enter").catch(() => {}); await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Details", exact: true }).click(); await p.waitForTimeout(1200);
    fs.writeFileSync(path.join(__dirname, ".frames/details.txt"), (await p.$$eval("label,input,textarea", (els) => els.map((e) => e.tagName + ":" + (e.getAttribute("aria-label") || e.getAttribute("placeholder") || e.textContent || "").trim().slice(0, 40)))).join("\n"));
    const author = p.getByText(/^Author/).first().locator("xpath=following::input[1]");
    if (await author.count()) { await author.fill("രസിയ"); await author.press("Tab"); }
    await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Page", exact: true }).click(); await p.waitForTimeout(1000);
    await p.getByRole("button", { name: /Front cover/ }).first().click().catch(() => {}); await p.waitForTimeout(2000);
    const presets = p.locator("button").filter({ hasText: "നിലാവുള്ള രാത്രി" });
    console.log("presets", await presets.count());
    const rec = await recorder(p, "cover", W, H); await p.waitForTimeout(1300);
    for (const i of [3, 6, 1, 8]) { rec.mark("preset" + i); await presets.nth(i).evaluate((e) => e.click()); await p.waitForTimeout(1300); }
    rec.mark("end"); await rec.stop(); await b.close();
  },
  // Desktop: the same editor on a laptop-size window, for the monitor shot.
  async desktop() {
    const { b, p, url } = await open({ w: 1440, h: 900, scale: 4 / 3, mobile: false }); const r = rng(3);
    await p.goto(url("/desk/")); await p.waitForTimeout(1500);
    await p.getByRole("button", { name: "New work" }).first().click(); await p.waitForTimeout(800);
    await p.getByText("ചെറുകഥ", { exact: false }).first().click(); await p.waitForTimeout(2500);
    await p.locator(".ProseMirror > *").first().click(); await p.keyboard.type("nilaavuLLa raathri", { delay: 15 }); await p.keyboard.press("Enter");
    await p.keyboard.type("rasiya ", { delay: 15 }); await p.keyboard.press("Enter");
    await p.keyboard.type("puRaththu nilaavu peythirunnu. aayisha jaalakam thuRannu. ", { delay: 15 }); await p.waitForTimeout(800);
    const rec = await recorder(p, "desktop", 1920, 1200); await p.waitForTimeout(600);
    rec.mark("type"); await human(p, "meenaakshi chirichchu. ", r, { base: 90 }); await p.waitForTimeout(1500); rec.mark("end");
    await rec.stop(); await b.close();
  },
};
(async () => { fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(path.join(__dirname, ".frames"), { recursive: true });
  const want = process.argv.slice(2); for (const k of want.length ? want : Object.keys(SHOTS)) await SHOTS[k](); })();
