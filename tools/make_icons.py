#!/usr/bin/env python3
"""Generate SCATERNET toolbar icons (ska: gold music note + 2-tone checkerboard).

Renders each size at 4x then downsamples for clean anti-aliased edges.
Outputs: assets/icons/icon-{16,32,48,128}.png  (ON, colour)
         assets/icons/icon-{16,32,48,128}-off.png (OFF, greyscale)

Run:  ./.venv/bin/python tools/make_icons.py
"""
from pathlib import Path
from PIL import Image, ImageDraw

SIZES = [16, 32, 48, 128]
OUT = Path(__file__).resolve().parent.parent / "assets" / "icons"

# Palette — Jamaican green / gold / black
BG_ON = (12, 59, 30)      # Jamaican green
NOTE_ON = (255, 210, 74)  # gold
CHECK_A_ON = (255, 210, 74)
CHECK_B_ON = (17, 17, 17)
BG_OFF = (150, 150, 150)
NOTE_OFF = (90, 90, 90)
CHECK_A_OFF = (120, 120, 120)
CHECK_B_OFF = (80, 80, 80)


def draw_checker_band(d, S, a, b):
    """A 2-tone checkerboard strip across the bottom."""
    rows = 2
    cols = 8
    band_h = S * 0.22
    y0 = S - band_h
    cw = S / cols
    ch = band_h / rows
    for r in range(rows):
        for c in range(cols):
            fill = a if (r + c) % 2 == 0 else b
            x = c * cw
            y = y0 + r * ch
            d.rectangle([x, y, x + cw, y + ch], fill=fill)


def draw_note(d, S, color):
    """An eighth note: round head (lower-left) + stem + flag."""
    head_r = S * 0.16
    head_cx = S * 0.40
    head_cy = S * 0.58
    # slight italic tilt via an ellipse
    d.ellipse([head_cx - head_r * 1.15, head_cy - head_r,
               head_cx + head_r * 1.15, head_cy + head_r], fill=color)
    # stem
    stem_w = max(2, S * 0.055)
    stem_x = head_cx + head_r * 0.95
    stem_top = S * 0.20
    d.rectangle([stem_x, stem_top, stem_x + stem_w, head_cy], fill=color)
    # flag (a curved-ish wedge, approximated by a triangle/polygon)
    d.polygon([
        (stem_x + stem_w, stem_top),
        (stem_x + stem_w + S * 0.18, stem_top + S * 0.10),
        (stem_x + stem_w + S * 0.14, stem_top + S * 0.24),
        (stem_x + stem_w, stem_top + S * 0.12),
    ], fill=color)


def make(size, bg, note, ca, cb, suffix):
    scale = 4
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    radius = int(S * 0.22)
    d.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=bg)
    draw_note(d, S, note)
    draw_checker_band(d, S, ca, cb)
    # re-clip the rounded corners over the band by masking
    mask = Image.new("L", (S, S), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, S - 1, S - 1], radius=radius, fill=255)
    img.putalpha(mask)
    img = img.resize((size, size), Image.LANCZOS)
    path = OUT / f"icon-{size}{suffix}.png"
    img.save(path)
    return path


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    made = []
    for s in SIZES:
        made.append(make(s, BG_ON, NOTE_ON, CHECK_A_ON, CHECK_B_ON, ""))
        made.append(make(s, BG_OFF, NOTE_OFF, CHECK_A_OFF, CHECK_B_OFF, "-off"))
    print(f"Wrote {len(made)} icons to {OUT}")


if __name__ == "__main__":
    main()
