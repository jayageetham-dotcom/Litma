/**
 * Litma desktop (Electron).
 *
 * The window runs the same static web app as https://getlitma.in, bundled into the
 * installer and served from the private `app://litma/` origin, so it opens instantly and keeps
 * working when the network drops: works are kept on this computer and changes made offline are
 * synced when the connection returns (apps/web/src/lib/offline.ts). Dictionary data and fonts are
 * kept on disk the first time they load (`kept()` below), so they work offline too.
 * Accounts, documents and AI still talk to Supabase over the network, exactly like the website.
 */
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, net, protocol, shell, type MenuItemConstructorOptions } from "electron";
import { checkForUpdates, currentState, downloadUpdate, installUpdate, startUpdateChecks } from "./updater";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const SCHEME = "app";
const HOST = "litma";
const ORIGIN = `${SCHEME}://${HOST}`;
/** the website: dictionary data and auth callbacks live here */
const SITE = "https://getlitma.in";
/** the website's old address (redirects to SITE once it is live); links and callbacks from it still work */
const LEGACY_SITE = "https://www.jayageetham.com/litma";
/** the website address a URL starts with, if any */
const siteOf = (url: string) => [SITE, "https://www.getlitma.in", LEGACY_SITE].find((s) => url === s || url.startsWith(`${s}/`) || url.startsWith(`${s}?`));
const WEB_ROOT = join(__dirname, "..", "app", "web");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// ── files from the network, kept on disk so they still load offline ──
const keptDir = () => join(app.getPath("userData"), "offline-cache");
const keptFile = (key: string) => join(keptDir(), createHash("sha1").update(key).digest("hex"));
/** keys already refreshed in this run (a kept copy is refreshed at most once per start) */
const refreshed = new Set<string>();

/**
 * Serve `key` from the first source that answers, keeping a copy on disk; when none answers
 * (offline), serve the kept copy. `cacheFirst`: answer from the kept copy straight away
 * (refreshing it in the background unless `immutable`). `rewrite` edits text bodies before keeping.
 */
async function kept(key: string, sources: string[], opts: { cacheFirst?: boolean; immutable?: boolean; rewrite?: (text: string) => string } = {}): Promise<Response> {
  const file = keptFile(key);
  const fromDisk = async () => {
    try {
      const [body, type] = await Promise.all([readFile(file), readFile(`${file}.type`, "utf8")]);
      return new Response(body, { headers: { "content-type": type } });
    } catch {
      return null;
    }
  };
  const fromNetwork = async () => {
    refreshed.add(key);
    for (const src of sources) {
      try {
        const res = await net.fetch(src, { signal: AbortSignal.timeout(20_000) });
        if (!res.ok) continue;
        const type = res.headers.get("content-type") ?? "application/octet-stream";
        let body = Buffer.from(await res.arrayBuffer());
        if (opts.rewrite) body = Buffer.from(opts.rewrite(body.toString("utf8")));
        await mkdir(keptDir(), { recursive: true });
        await writeFile(file, body);
        await writeFile(`${file}.type`, type);
        return new Response(body, { headers: { "content-type": type } });
      } catch {
        /* offline or unreachable: try the next source */
      }
    }
    return null;
  };
  if (opts.cacheFirst) {
    const disk = await fromDisk();
    if (disk) {
      if (!opts.immutable && !refreshed.has(key)) void fromNetwork();
      return disk;
    }
  }
  return (await fromNetwork()) ?? (await fromDisk()) ?? new Response("Offline", { status: 504 });
}

async function serve(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let rel = decodeURIComponent(url.pathname);
  // dictionary shards are large: fetched from the website and kept on disk once used
  // (until getlitma.in is live, the old address still has the data)
  if (rel.startsWith("/dict/")) return kept(rel + url.search, [`${SITE}${rel}${url.search}`, `${LEGACY_SITE}${rel}${url.search}`], { cacheFirst: true });
  // Google Fonts go through here in the desktop build (app/layout.tsx), so the Malayalam fonts work offline
  if (rel === "/gfonts/css2")
    return kept(`gfonts${url.search}`, [`https://fonts.googleapis.com/css2${url.search}`], {
      cacheFirst: true,
      rewrite: (css) => css.replaceAll("https://fonts.gstatic.com/", `${ORIGIN}/gstatic/`),
    });
  if (rel.startsWith("/gstatic/")) return kept(rel, [`https://fonts.gstatic.com/${rel.slice("/gstatic/".length)}`], { cacheFirst: true, immutable: true });
  const target = normalize(join(WEB_ROOT, rel));
  if (!target.startsWith(WEB_ROOT + sep) && target !== WEB_ROOT) return new Response("Forbidden", { status: 403 });
  let file = target;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, "index.html");
  } catch {
    // pretty URLs without a trailing slash: /desk → /desk/index.html
    if (existsSync(join(target, "index.html"))) file = join(target, "index.html");
    else if (existsSync(`${target}.html`)) file = `${target}.html`;
  }
  try {
    const body = await readFile(file);
    return new Response(body, { headers: { "content-type": MIME[extname(file)] ?? "application/octet-stream" } });
  } catch {
    rel = "/404.html";
    const body = await readFile(join(WEB_ROOT, rel)).catch(() => Buffer.from("Not found"));
    return new Response(body, { status: 404, headers: { "content-type": MIME[".html"] } });
  }
}

// ── window size and position survive restarts ──
type Bounds = { width: number; height: number; x?: number; y?: number; maximized?: boolean };
const stateFile = () => join(app.getPath("userData"), "window-state.json");
function readBounds(): Bounds {
  try {
    return JSON.parse(readFileSync(stateFile(), "utf8")) as Bounds;
  } catch {
    return { width: 1320, height: 880 };
  }
}
function saveBounds(win: BrowserWindow) {
  try {
    const b = win.getNormalBounds();
    writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {
    /* ignore */
  }
}

/** pages that may open inside the app window (sign-in providers); everything else opens in the browser */
const IN_APP_HOSTS = [/\.supabase\.co$/, /^accounts\.google\.com$/, /^github\.com$/, /^appleid\.apple\.com$/];

function routeNavigation(win: BrowserWindow) {
  const wc = win.webContents;
  const handle = (event: Electron.Event, raw: string) => {
    if (raw.startsWith(ORIGIN)) return;
    // auth callbacks land on the website: bring them into the app so the session is stored here
    const site = siteOf(raw);
    if (site && raw.startsWith(`${site}/auth/callback`)) {
      event.preventDefault();
      win.loadURL(ORIGIN + raw.slice(site.length));
      return;
    }
    const host = (() => {
      try {
        return new URL(raw).hostname;
      } catch {
        return "";
      }
    })();
    if (IN_APP_HOSTS.some((re) => re.test(host))) return;
    event.preventDefault();
    if (/^https?:|^mailto:/.test(raw)) shell.openExternal(raw);
  };
  wc.on("will-navigate", handle);
  wc.on("will-redirect", handle);
  wc.setWindowOpenHandler(({ url }) => {
    // reader view, print/PDF view and book previews open as app windows
    if (url.startsWith(ORIGIN)) return { action: "allow", overrideBrowserWindowOptions: { width: 1100, height: 860, autoHideMenuBar: true } };
    const site = siteOf(url);
    // the help site is read in the browser, beside the app (Settings → Help and guide, Help menu)
    const help = site && /^\/help(\/|$|\?)/.test(url.slice(site.length));
    if (site && !help && url.startsWith(`${site}/`) && !url.includes("/auth/")) {
      createWindow(ORIGIN + url.slice(site.length));
      return { action: "deny" };
    }
    if (/^https?:|^mailto:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
}

function createWindow(url = `${ORIGIN}/desk/`) {
  const saved = readBounds();
  const win = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    x: saved.x,
    y: saved.y,
    minWidth: 380,
    minHeight: 520,
    title: "Litma",
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#09090b" : "#f4f4f5",
    autoHideMenuBar: process.platform !== "darwin",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false, // Malayalam spell-check isn't available; underlines would cover every word
      additionalArguments: [`--litma-version=${app.getVersion()}`],
    },
  });
  if (saved.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());
  win.on("close", () => saveBounds(win));
  routeNavigation(win);
  win.loadURL(url);
  return win;
}

function buildMenu() {
  const mac = process.platform === "darwin";
  const template: MenuItemConstructorOptions[] = [
    ...(mac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" as const },
              { label: "Check for Updates…", click: () => checkForUpdates(true) },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [
        { label: "New window", accelerator: "CmdOrCtrl+Shift+N", click: () => createWindow() },
        { label: "Desk", accelerator: "CmdOrCtrl+Shift+D", click: (_i, w) => (w as BrowserWindow | undefined)?.loadURL(`${ORIGIN}/desk/`) },
        { label: "Dictionary", accelerator: "CmdOrCtrl+Shift+Y", click: (_i, w) => (w as BrowserWindow | undefined)?.loadURL(`${ORIGIN}/dictionary/`) },
        { type: "separator" },
        mac ? { role: "close" } : { role: "quit" },
      ],
    },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
    {
      role: "help",
      submenu: [
        ...(mac ? [] : [{ label: "Check for updates…", click: () => checkForUpdates(true) }, { type: "separator" as const }]),
        { label: "Litma Help", accelerator: mac ? undefined : "F1", click: () => shell.openExternal(`${SITE}/help/`) },
        { type: "separator" },
        { label: `Litma ${app.getVersion()}`, enabled: false },
        { label: "Litma on the web", click: () => shell.openExternal(SITE) },
        { label: "Report a problem", click: () => shell.openExternal("mailto:support@getlitma.in?subject=Litma%20desktop") },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    protocol.handle(SCHEME, serve);
    ipcMain.handle("litma:update:check", () => checkForUpdates(true));
    ipcMain.handle("litma:update:state", () => currentState());
    ipcMain.handle("litma:update:download", () => downloadUpdate());
    ipcMain.handle("litma:update:install", () => installUpdate());
    buildMenu();
    startUpdateChecks();
    createWindow();
    app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
  });
  app.on("window-all-closed", () => process.platform !== "darwin" && app.quit());
}
