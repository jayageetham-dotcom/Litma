/**
 * Litma desktop (Electron).
 *
 * The window runs the same static web app as https://www.jayageetham.com/litma, bundled into the
 * installer and served from the private `app://litma/` origin, so it opens instantly and keeps
 * working when the network drops (writing is journalled locally and synced by the app itself).
 * Accounts, documents and AI still talk to Supabase over the network, exactly like the website.
 */
import { app, BrowserWindow, ipcMain, Menu, nativeTheme, net, protocol, shell, type MenuItemConstructorOptions } from "electron";
import { checkForUpdates, currentState, downloadUpdate, installUpdate, startUpdateChecks } from "./updater";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const SCHEME = "app";
const HOST = "litma";
const ORIGIN = `${SCHEME}://${HOST}`;
/** the website: dictionary data and auth callbacks live here */
const SITE = "https://www.jayageetham.com/litma";
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

async function serve(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let rel = decodeURIComponent(url.pathname);
  // dictionary shards are large: fetch them from the website (Chromium caches them)
  if (rel.startsWith("/dict/")) return net.fetch(`${SITE}${rel}${url.search}`);
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
    if (raw.startsWith(`${SITE}/auth/callback`)) {
      event.preventDefault();
      win.loadURL(raw.replace(SITE, ORIGIN));
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
    if (url.startsWith(`${SITE}/`) && !url.includes("/auth/")) {
      createWindow(url.replace(SITE, ORIGIN));
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
        { label: `Litma ${app.getVersion()}`, enabled: false },
        { label: "What's new", click: () => shell.openExternal("https://github.com/jayageetham-dotcom/Litma/blob/main/CHANGELOG.md") },
        { label: "Litma on the web", click: () => shell.openExternal(SITE) },
        { label: "Report a problem", click: () => shell.openExternal("mailto:jagath.gj@gmail.com?subject=Litma%20desktop") },
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
