#!/usr/bin/env python3
"""Render the web cover backgrounds (SVG) to JPEG for the phone app. See apps/mobile/assets/covers/README.md."""
import sys, pathlib
from playwright.sync_api import sync_playwright
src = pathlib.Path(sys.argv[1]); out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
W, H = 1500, 2220  # 6.125 x 9.25 in at ~245 dpi (A4 cover ~180 dpi): sharp in a printed PDF; previews decode smaller
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": W, "height": H})
    for f in sorted(src.glob("*.svg")):
        pg.set_content(f"<html><body style='margin:0'><img src='data:image/svg+xml;base64,{__import__('base64').b64encode(f.read_bytes()).decode()}' style='width:{W}px;height:{H}px;display:block'></body></html>")
        pg.wait_for_timeout(300)
        pg.screenshot(path=str(out / (f.stem + ".jpg")), type="jpeg", quality=84, full_page=False)
    b.close()
