#!/usr/bin/env python3
"""Generate SCATERNET toolbar icons: 🎷 saxophone emoji on a brown background.

Renders the emoji with Apple Color Emoji (macOS), composites it centered on a
brown rounded-square, and downsamples to each size for clean edges.
Outputs: assets/icons/icon-{16,32,48,128}.png  (ON, brown)
         assets/icons/icon-{16,32,48,128}-off.png (OFF, muted)

Run:  ./.venv/bin/python tools/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SIZES = [16, 32, 48, 128]
OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"
EMOJI = "🎷"
EMOJI_FONT = "/System/Library/Fonts/Apple Color Emoji.ttc"
# Apple Color Emoji only renders at specific bitmap strike sizes; try known ones.
STRIKE_CANDIDATES = [160, 96, 64, 48, 40, 32, 20]

BG_ON = (107, 68, 35)     # brown
BG_OFF = (120, 110, 100)  # muted grey-brown (disabled state)


def render_emoji():
    """Render the emoji to a tight RGBA image using Apple Color Emoji."""
    font = None
    for sz in STRIKE_CANDIDATES:
        try:
            font = ImageFont.truetype(EMOJI_FONT, sz)
            strike = sz
            break
        except OSError:
            continue
    if font is None:
        raise SystemExit("No valid Apple Color Emoji strike size found")
    canvas = Image.new("RGBA", (strike * 2, strike * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(canvas)
    d.text((strike // 2, strike // 2), EMOJI, font=font, embedded_color=True)
    bbox = canvas.getbbox()
    return canvas.crop(bbox) if bbox else canvas


def make(size, bg, suffix, glyph):
    scale = 8
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * 0.22), fill=bg + (255,))
    # fit the emoji to ~72% of the square, centered
    target = int(S * 0.72)
    g = glyph.copy()
    gw, gh = g.size
    r = min(target / gw, target / gh)
    g = g.resize((max(1, int(gw * r)), max(1, int(gh * r))), Image.LANCZOS)
    img.alpha_composite(g, ((S - g.width) // 2, (S - g.height) // 2))
    img = img.resize((size, size), Image.LANCZOS)
    path = OUT / f"icon-{size}{suffix}.png"
    img.save(path)
    return path


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    glyph = render_emoji()
    made = []
    for s in SIZES:
        made.append(make(s, BG_ON, "", glyph))
        made.append(make(s, BG_OFF, "-off", glyph))
    print(f"Wrote {len(made)} icons (🎷 on brown) to {OUT}")


if __name__ == "__main__":
    main()
