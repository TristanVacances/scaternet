#!/usr/bin/env python3
"""Synthesize a WIDE spectrum of cartoon fart noises with ffmpeg.

CC0 fart SFX are scarce, so we manufacture our own: a low buzzy tone whose pitch
wobbles (vibrato) and bends over a short decaying envelope = a brap. Sweeping the
base pitch, wobble rate, bend direction, duration and grit gives dozens of
distinct farts (wet, dry, squeaky, long, machine-gun, sputtering). These OWN
assets bundle freely.

Outputs: assets/audio/farts/fart-syn-NN.mp3
Run:  ./.venv/bin/python tools/synth_farts.py   (needs ffmpeg)
Appends to whatever CC0 farts fetch_farts.py already banked.
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio" / "farts"
FFMPEG = "ffmpeg"

# (base_hz, wobble_hz, bend, dur, decay, grit)  -> one distinct fart each
VARIANTS = [
    (90, 18, 0, 0.45, 4.0, 0.10),   # classic mid brap
    (70, 12, -30, 0.70, 2.6, 0.12),  # long low decline
    (130, 26, 20, 0.30, 5.0, 0.06),  # squeaky rise
    (60, 9, -20, 0.90, 2.0, 0.15),   # deep long
    (110, 30, 0, 0.35, 4.5, 0.20),   # gritty buzz
    (100, 16, 40, 0.40, 4.0, 0.08),  # rising toot
    (80, 22, -10, 0.55, 3.2, 0.14),  # wet mid
    (140, 34, 30, 0.25, 6.0, 0.05),  # tiny squeak
    (75, 14, 0, 0.65, 2.8, 0.18),    # flappy
    (95, 20, -40, 0.50, 3.6, 0.10),  # descending brap
    (65, 11, 10, 0.80, 2.2, 0.16),   # rumbling
    (120, 28, -20, 0.32, 5.2, 0.09),  # pinched
    (85, 24, 50, 0.42, 3.8, 0.22),   # sputter-rise
    (105, 17, -15, 0.48, 4.0, 0.11),  # honky mid
    (72, 13, -25, 0.75, 2.5, 0.13),  # long wet decline
    (135, 32, 25, 0.28, 5.5, 0.07),  # squeaky short
]


def synth(idx, base, wob, bend, dur, decay, grit):
    # Frequency = base + vibrato + linear bend over time.
    # A square-ish tone (sum of a few harmonics) reads as "brap"; add noise grit.
    freq = f"({base}+{wob}*sin(2*PI*t*{wob})+{bend}*t/{dur})"
    tone = (f"0.6*sin(2*PI*t*{freq})"
            f"+0.3*sin(4*PI*t*{freq})"
            f"+0.15*sin(6*PI*t*{freq})")
    env = f"exp(-{decay}*t)"
    expr = f"({tone}+{grit}*random(0))*{env}"
    out = OUT / f"fart-syn-{idx:02d}.mp3"
    src = f"aevalsrc={expr}:d={dur}:s=44100"
    # gentle fade tail + loudness normalise so they sit with the CC0 farts
    af = f"afade=t=out:st={max(0.02, dur-0.08):.2f}:d=0.08,loudnorm=I=-15:TP=-1.5:LRA=11"
    r = subprocess.run(
        [FFMPEG, "-y", "-f", "lavfi", "-i", src, "-af", af,
         "-ac", "1", "-ar", "44100", "-b:a", "96k", str(out)],
        capture_output=True,
    )
    if r.returncode != 0 or not out.exists() or out.stat().st_size < 500:
        print(f"  ✗ fart-syn-{idx:02d} failed: {r.stderr.decode()[-160:]}")
        return False
    print(f"  ✓ fart-syn-{idx:02d}.mp3  base={base} wob={wob} bend={bend} dur={dur}")
    return True


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("fart-syn-*.mp3"):
        old.unlink()
    n = 0
    for i, v in enumerate(VARIANTS, 1):
        if synth(i, *v):
            n += 1
    print(f"\nSynthesized {n} farts -> {OUT}")


if __name__ == "__main__":
    main()
