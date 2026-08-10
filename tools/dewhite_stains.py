#!/usr/bin/env python3
"""Turn the white background of each stain PNG into REAL transparency.

The stains are brown-on-white. We key out white by the per-pixel MIN channel
(white has a high min; brown/tan mud has a low-to-mid min), with a soft ramp so
edges and fine droplets stay. Unlike subject-based background removal, this keeps
every scattered speck (they're just "not white"). Fast, vectorised PIL point ops.

Edits assets/stains/*.png in place -> RGBA with transparent surround.
Run:  ./.venv/bin/python tools/dewhite_stains.py
"""
from pathlib import Path
from PIL import Image, ImageChops

OUT = Path(__file__).resolve().parent.parent / "assets" / "stains"
LO, HI = 205, 248  # min-channel: <=LO fully opaque, >=HI fully transparent, ramp between


def alpha_from_min(minrgb):
    span = HI - LO
    return minrgb.point(lambda v: 255 if v <= LO else (0 if v >= HI else int(255 * (HI - v) / span)))


def main():
    n = 0
    for f in sorted(OUT.glob("stain-*.png")):
        im = Image.open(f).convert("RGBA")
        r, g, b, _ = im.split()
        minrgb = ImageChops.darker(ImageChops.darker(r, g), b)  # per-pixel min channel
        im.putalpha(alpha_from_min(minrgb))
        im.save(f)
        # quick opacity sanity: fraction of fully/partly opaque pixels
        a = im.getchannel("A")
        opaque = sum(1 for v in a.getdata() if v > 30)
        total = im.width * im.height
        print(f"  {f.name}: {opaque/total*100:.1f}% visible (rest transparent)")
        n += 1
    print(f"\nDe-whited {n} stains -> {OUT}")


if __name__ == "__main__":
    main()
