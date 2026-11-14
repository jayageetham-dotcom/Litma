#!/usr/bin/env python3
"""App Store iPad screenshots (13", 2064 x 2752) from the phone app's screenshot test.

1. Run the Mobile workflow by hand (Actions -> Mobile -> Run workflow). Its "screens" job renders
   test/screenshots/out/ipad-0N-*.png and puts them on the ci/phone-screens branch.
2. git fetch origin ci/phone-screens && git worktree add /tmp/screens FETCH_HEAD
3. python3 scripts/store-ipad-screens.py /tmp/screens marketing/store/app-store/ipad

Each picture gets the same caption and colour as the matching iPhone screenshot, with the iPad's
screen in a dark rounded frame. Needs Pillow (pip install pillow).
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 2064, 2752
INK = (21, 18, 48)
FRAME = (6, 3, 26)
FONT = Path(__file__).resolve().parent.parent / "apps/mobile/assets/fonts/Inter_700Bold.ttf"

# same order, captions and colours as the iPhone set (marketing/store/app-store/litma-ios-0N-*.png)
SHOTS = [
    ("ipad-01-desk", "litma-ipad-01-desk.png", "Your writing desk,\non a bigger page", (233, 228, 255)),
    ("ipad-02-editor-typing", "litma-ipad-02-editor-typing.png", "Type in Manglish,\nget Malayalam", (255, 230, 224)),
    ("ipad-03-editor-novel", "litma-ipad-03-editor-novel.png", "Novels and stories\non book-like pages", (226, 240, 255)),
    ("ipad-04-editor-poem", "litma-ipad-04-editor-poem.png", "Poems with stanzas\nand metre marks", (238, 248, 214)),
    ("ipad-05-dictionary", "litma-ipad-05-dictionary.png", "A Malayalam dictionary,\nbuilt in", (255, 235, 217)),
    ("ipad-06-nattarivu", "litma-ipad-06-nattarivu.png", "Words of Kerala,\ngathered by theme", (233, 228, 255)),
    ("ipad-07-story-world", "litma-ipad-07-story-world.png", "Plan your characters\nin Story World", (255, 230, 224)),
    ("ipad-08-cover-designer", "litma-ipad-08-cover-designer.png", "Design your book\nand its cover", (226, 240, 255)),
]


def rounded(size, radius):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return m


def compose(shot: Image.Image, caption: str, bg) -> Image.Image:
    out = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(out)
    font = ImageFont.truetype(str(FONT), 132)
    d.multiline_text((W // 2, 430), caption, font=font, fill=INK, anchor="mm", align="center", spacing=34)

    # the screen, scaled into a frame below the caption
    border, radius = 26, 84
    sh = 1860 - 2 * border
    sw = round(shot.width * sh / shot.height)
    fw, fh = sw + 2 * border, sh + 2 * border
    x, y = (W - fw) // 2, 700

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x, y + 40, x + fw, y + fh + 40), radius, fill=(40, 30, 90, 70))
    out.paste(shadow.filter(ImageFilter.GaussianBlur(60)), (0, 0), shadow.filter(ImageFilter.GaussianBlur(60)))

    frame = Image.new("RGB", (fw, fh), FRAME)
    out.paste(frame, (x, y), rounded((fw, fh), radius))
    screen = shot.convert("RGB").resize((sw, sh), Image.LANCZOS)
    out.paste(screen, (x + border, y + border), rounded((sw, sh), radius - border))
    return out


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    dst.mkdir(parents=True, exist_ok=True)
    for name, out_name, caption, bg in SHOTS:
        f = next(iter(src.rglob(f"{name}.png")), None)
        if f is None:
            print(f"missing {name}.png")
            continue
        compose(Image.open(f), caption, bg).save(dst / out_name, optimize=True)
        print(f"{out_name}")


if __name__ == "__main__":
    main()
