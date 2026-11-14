"""Mac App Store screenshots from a local-mode Litma, filled with the reviewer account's works."""
import json, sys
from datetime import date, timedelta
from common import *
from seed_data import DOCS, STORY, BOOKS, NOVEL

today = date(2026, 11, 14)
days = []
for i, w in enumerate([320, 410, 280, 520, 300, 0, 450]):
    if w:
        h = [0] * 24
        h[21] = w
        days.append({"day": (today - timedelta(days=i)).isoformat(), "words": w, "minutes": w // 12, "hours": h})

SEED = {
    "litma:docs": DOCS, "litma:story": STORY, "litma:books": BOOKS, "litma:days": days, "litma:work-days": [],
}
seed_js = "(() => { if (localStorage.getItem('litma:seeded')) return; const s = %s; for (const k in s) localStorage.setItem(k, JSON.stringify(s[k])); localStorage.setItem('litma:pinned', %s); localStorage.setItem('litma:seeded', '1'); })();" % (
    json.dumps(SEED, ensure_ascii=False), json.dumps(NOVEL))

only = sys.argv[1:]


def shot(page, name):
    hide_local_note(page)
    page.wait_for_timeout(600)
    page.screenshot(path=f"{OUT}/{name}.png")
    print("saved", name)


with sync_playwright() as p:
    b, ctx = start(p)
    ctx.add_init_script(seed_js)
    page = ctx.new_page()

    def go(path, wait=2500):
        page.goto(BASE + path)
        page.wait_for_timeout(wait)

    if not only or "desk" in only:
        go("/desk/")
        shot(page, "01-desk")

    if not only or "novel" in only:
        go(f"/write/?id={NOVEL}", 3500)
        shot(page, "03-novel")

    if not only or "typing" in only:
        go(f"/write/?id=a05601fa-6113-48a8-bf9f-ac2ee6dac0cd", 3500)
        # put the cursor at the end of the last paragraph and type a new sentence in Manglish
        last = page.locator(".ProseMirror > p").last
        last.click()
        page.keyboard.press("End")
        page.keyboard.press("Enter")
        page.keyboard.type("jOsaphETTan avante thOLil melle thatti. ", delay=40)
        page.keyboard.type("nALe", delay=60)
        page.wait_for_timeout(1500)
        shot(page, "02-typing")

    if not only or "poem" in only:
        go("/write/?id=53ea2027-e50b-43e6-87f6-ddae7157008b", 3500)
        shot(page, "04-poem")

    if not only or "dict" in only:
        go("/dictionary/?w=" + "മഴ", 3500)
        shot(page, "05-dictionary")

    if not only or "nattarivu" in only:
        go("/dictionary/?view=nattarivu", 3000)
        shot(page, "06-nattarivu")

    if not only or "story" in only:
        go(f"/write/?id={NOVEL}", 3500)
        btn = page.get_by_role("button", name="Story World")
        if btn.count():
            btn.first.click()
            page.wait_for_timeout(1500)
        page.mouse.move(700, 450)
        full = page.get_by_role("button", name=re.compile("^Open Story World|^Open S"))
        if full.count():
            full.first.click()
            page.wait_for_timeout(2500)
        page.mouse.move(5, 895)
        page.wait_for_timeout(800)
        shot(page, "07-story-world")
        # the plot board, if there is a tab for it
        tab = page.get_by_role("tab", name=re.compile("Plot|ബീറ്റ്|കഥാഗതി", re.I))
        if tab.count():
            tab.first.click(); page.wait_for_timeout(1500); page.mouse.move(5, 895)
            shot(page, "07b-plot-board")

    if not only or "cover" in only:
        go(f"/book/?id={BOOKS[0]['id']}", 3500)
        shot(page, "08-cover")

    b.close()
