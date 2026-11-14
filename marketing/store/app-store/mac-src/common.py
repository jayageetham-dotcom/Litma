"""Mac App Store screenshots of Litma: the web app at 1440 x 900 points, Retina (2x), as in the desktop app."""
import os, re
from playwright.sync_api import sync_playwright

ROOT = "/home/claude/litma"
CAP = f"{ROOT}/marketing/reels/capture"
BASE = "http://localhost:4173"
OUT = "/home/claude/shots/raw"
os.makedirs(OUT, exist_ok=True)

# the desktop app's bridge: download links and the website's update notice stay hidden, as in the app
DESKTOP = "window.litmaDesktop = { platform: 'darwin', version: '0.7.24', store: 'mas' };"


def start(p, state=None):
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2, locale="en-IN",
                        storage_state=state, color_scheme="light")
    ctx.add_init_script(DESKTOP)
    css = open(f"{CAP}/google-fonts.css").read()
    ctx.route(re.compile(r"fonts\.googleapis\.com"), lambda r: r.fulfill(content_type="text/css", body=css))

    def font(r):
        u = r.request.url.split("/__fonts/", 1)[1].split("?")[0]
        from urllib.parse import unquote
        r.fulfill(content_type="font/woff2", body=open(f"{CAP}/node_modules/{unquote(u)}", "rb").read())
    ctx.route(re.compile(r"/__fonts/"), font)
    # nothing else leaves the machine (analytics, Google Input Tools)
    ctx.route(re.compile(r"^https://(?!fonts\.googleapis\.com)"), lambda r: r.abort())
    return b, ctx


def hide_local_note(page):
    page.evaluate("""() => { for (const el of document.querySelectorAll('div,p'))
      if (/^Local mode/.test(el.textContent?.trim() || '') && el.children.length < 3) el.style.display = 'none';
      // the save line of this local copy (the app says it is saved to Litma instead)
      for (const el of document.querySelectorAll('span,div'))
        if (el.children.length === 0 && /^Saved in this browser/.test(el.textContent?.trim() || '')) el.style.visibility = 'hidden'; }""")
