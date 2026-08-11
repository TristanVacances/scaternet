#!/usr/bin/env python3
"""Compose a BEFORE/AFTER store screenshot (1280x800, no alpha) from two shots.

Stacks the top band of the BEFORE shot over the top band of the AFTER shot, with
small square "BEFORE" / "AFTER" badges. Output is a 24-bit (RGB, no-alpha) PNG,
matching the Chrome Web Store screenshot spec (1280x800).

Usage: compose-beforeafter.py <before.png> <after.png> <out.png>
"""
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 800
HALF = H // 2  # 400

FONT_CANDIDATES = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/HelveticaNeue.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
]


def load_font(size):
    for p in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


def band(path):
    """Top 400px band of a 1280x800 shot (RGB)."""
    im = Image.open(path).convert("RGB")
    if im.size != (W, H):
        im = im.resize((W, H))
    return im.crop((0, 0, W, HALF))


def badge(draw, xy, text, font):
    pad_x, pad_y = 18, 10
    tb = draw.textbbox((0, 0), text, font=font)
    tw, th = tb[2] - tb[0], tb[3] - tb[1]
    x, y = xy
    box = [x, y, x + tw + 2 * pad_x, y + th + 2 * pad_y]
    draw.rounded_rectangle(box, radius=10, fill=(107, 68, 35))  # brown
    draw.rounded_rectangle(box, radius=10, outline=(255, 255, 255), width=3)
    draw.text((x + pad_x, y + pad_y - tb[1]), text, font=font, fill=(255, 255, 255))


def main():
    before, after, out = sys.argv[1], sys.argv[2], sys.argv[3]
    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    canvas.paste(band(before), (0, 0))
    canvas.paste(band(after), (0, HALF))
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, HALF - 3, W, HALF + 3], fill=(30, 20, 10))  # divider
    font = load_font(34)
    badge(d, (28, 26), "BEFORE", font)
    badge(d, (28, HALF + 26), "AFTER", font)
    canvas.save(out)  # RGB PNG, no alpha
    print("wrote", out, canvas.size, canvas.mode)


if __name__ == "__main__":
    main()
