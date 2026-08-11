#!/usr/bin/env python3
"""Generate SCATERNET Chrome Web Store promo tiles (24-bit PNG, no alpha).
 - Small promo tile:   440 x 280
 - Marquee promo tile: 1400 x 560

Composes a hero musician photo + big title + tagline + a mud-splat accent on the
ska colour scheme (Jamaican green / gold / brown).

Run:  ./.venv/bin/python tools/make-promo.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "images"
STAIN = ROOT / "assets" / "stains"
OUT = ROOT / "store" / "promo"

GREEN = (12, 59, 30)
GOLD = (255, 210, 74)
CREAM = (255, 246, 224)

TITLE_FONTS = ["/System/Library/Fonts/Supplemental/Impact.ttf",
               "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
               "/System/Library/Fonts/HelveticaNeue.ttc"]
BODY_FONTS = ["/System/Library/Fonts/Supplemental/Arial.ttf",
              "/System/Library/Fonts/HelveticaNeue.ttc",
              "/System/Library/Fonts/Helvetica.ttc"]


def font(cands, size):
    for p in cands:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def cover(im, w, h):
    """Scale + center-crop to exactly w x h."""
    im = im.convert("RGBA")
    r = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x = (im.width - w) // 2
    y = (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def stain(name, size):
    s = Image.open(STAIN / name).convert("RGBA")
    r = size / max(s.width, s.height)
    return s.resize((round(s.width * r), round(s.height * r)), Image.LANCZOS)


def small():
    W, H = 440, 280
    base = cover(Image.open(IMG / "img-01.jpg"), W, H)
    # bottom darkening for legibility
    grad = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    for y in range(H):
        a = int(235 * max(0.0, (y - 120) / 160.0))
        gd.line([(0, y), (W, y)], fill=(8, 24, 14, min(a, 235)))
    base = Image.alpha_composite(base, grad)
    base.alpha_composite(stain("stain-03.png", 150), (300, -18))
    d = ImageDraw.Draw(base)
    d.text((22, 150), "SCATERNET", font=font(TITLE_FONTS, 52), fill=GOLD)
    d.text((24, 214), "the internet, on ska", font=font(BODY_FONTS, 24), fill=CREAM)
    base.convert("RGB").save(OUT / "promo-small-440x280.png")
    print("wrote promo-small-440x280.png")


def marquee():
    W, H = 1400, 560
    canvas = Image.new("RGBA", (W, H), GREEN + (255,))
    hero = cover(Image.open(IMG / "img-01.jpg"), 640, H)
    # feather the left edge of the hero into the green
    mask = Image.new("L", (640, H), 255)
    md = ImageDraw.Draw(mask)
    for x in range(160):
        md.line([(x, 0), (x, H)], fill=int(255 * x / 160))
    canvas.paste(hero, (W - 640, 0), mask)
    canvas.alpha_composite(stain("stain-01.png", 260), (560, 300))
    canvas.alpha_composite(stain("stain-05.png", 200), (40, -30))
    d = ImageDraw.Draw(canvas)
    d.text((60, 120), "SCATERNET", font=font(TITLE_FONTS, 150), fill=GOLD)
    d.text((66, 300), "the internet, on ska", font=font(BODY_FONTS, 52), fill=CREAM)
    d.text((66, 372), "skabidibi doubidou bada boudi booo!", font=font(BODY_FONTS, 30), fill=GOLD)
    canvas.convert("RGB").save(OUT / "promo-marquee-1400x560.png")
    print("wrote promo-marquee-1400x560.png")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    small()
    marquee()


if __name__ == "__main__":
    main()
