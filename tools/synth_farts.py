#!/usr/bin/env python3
"""Synthesize a WIDE spectrum of REALISTIC fart noises with ffmpeg.

Real farts are not tones — they're brown noise forced through a small resonant
cavity with rapid pitch + amplitude flutter (the "brrrap"). So we build each one:
  brown noise -> resonant bandpass + resonance boost -> vibrato (pitch flutter)
  -> tremolo (amplitude flutter) -> decay -> loudness-normalise.
Sweeping centre freq / resonance / flutter rate / length gives wet, dry, squeaky,
long, sputtering and machine-gun farts. Owned assets, bundle freely.

Outputs: assets/audio/farts/fart-syn-NN.mp3
Run:  ./.venv/bin/python tools/synth_farts.py   (needs ffmpeg)
Appends to whatever CC0 farts fetch_farts.py already banked.
"""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio" / "farts"
FFMPEG = "ffmpeg"

# (centre_hz, bandwidth, resonance_gain, flutter_hz, dur, amp) -> one distinct fart
VARIANTS = [
    (150, 90, 10, 22, 0.55, 0.9),    # classic wet mid brap
    (110, 70, 12, 16, 0.85, 0.9),    # long low wet
    (240, 120, 8, 34, 0.32, 0.85),   # squeaky short
    (95, 60, 13, 12, 1.05, 0.9),     # deep long rumble
    (180, 100, 11, 40, 0.40, 0.9),   # machine-gun flutter
    (130, 80, 10, 26, 0.60, 0.9),    # standard wet
    (300, 140, 7, 44, 0.28, 0.8),    # tiny squeak
    (120, 70, 12, 18, 0.75, 0.9),    # flappy medium
    (160, 90, 10, 30, 0.48, 0.9),    # sputter
    (100, 65, 13, 14, 0.95, 0.9),    # long wet decline
    (210, 110, 9, 38, 0.35, 0.85),   # pinched high
    (140, 85, 11, 24, 0.65, 0.9),    # honky mid
    (115, 72, 12, 20, 0.80, 0.9),    # gassy long
    (260, 130, 8, 42, 0.30, 0.8),    # squeaky rapid
    (125, 78, 11, 28, 0.55, 0.9),    # bubbly mid
    (105, 68, 13, 15, 1.10, 0.9),    # very long deep
    (190, 100, 10, 36, 0.42, 0.88),  # brassy sputter
    (135, 82, 11, 21, 0.70, 0.9),    # wet flap
    (155, 92, 10, 45, 0.38, 0.9),    # rapid machine-gun
    (170, 95, 10, 25, 0.58, 0.9),    # meaty mid
]


def synth(idx, centre, bw, res, flutter, dur, amp):
    src = f"anoisesrc=color=brown:amplitude={amp}:duration={dur}:sample_rate=44100"
    fade_st = max(0.02, dur - 0.12)
    af = (
        f"bandpass=f={centre}:width_type=h:w={bw},"
        f"equalizer=f={centre}:width_type=q:width=1.2:g={res},"
        f"vibrato=f={flutter}:d=0.6,"
        f"tremolo=f={flutter}:d=0.85,"
        # gentle exponential-ish decay so it dies like a real one
        f"afade=t=in:st=0:d=0.015,afade=t=out:st={fade_st:.2f}:d=0.12,"
        f"loudnorm=I=-14:TP=-1.2:LRA=11"
    )
    out = OUT / f"fart-syn-{idx:02d}.mp3"
    r = subprocess.run(
        [FFMPEG, "-y", "-f", "lavfi", "-i", src, "-af", af,
         "-ac", "1", "-ar", "44100", "-b:a", "112k", str(out)],
        capture_output=True,
    )
    if r.returncode != 0 or not out.exists() or out.stat().st_size < 500:
        print(f"  ✗ fart-syn-{idx:02d} failed: {r.stderr.decode()[-160:]}")
        return False
    print(f"  ✓ fart-syn-{idx:02d}.mp3  centre={centre} flutter={flutter} dur={dur}")
    return True


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("fart-syn-*.mp3"):
        old.unlink()
    n = 0
    for i, v in enumerate(VARIANTS, 1):
        if synth(i, *v):
            n += 1
    print(f"\nSynthesized {n} realistic farts -> {OUT}")


if __name__ == "__main__":
    main()
