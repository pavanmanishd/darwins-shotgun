"""Original 150 BPM tracks for the trailer cuts.

Usage: make_track.py <videoDir> <full|teaser> <phonk|darksynth>
Writes public/music-raw-<cut>-<style>.wav and src/timing-<cut>.json.
"""

import json
import sys
from pathlib import Path

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
BPM = 150
BEAT = 60 / BPM
BAR = 4 * BEAT
STEP = BEAT / 4
TAIL = 0.6
rng = np.random.default_rng(7)

CUTS = {
    "full": {
        "hook": (0, 2),
        "intro": (2, 8),
        "riser": (8, 10),
        "drop1": (10, 18),
        "breakdown": (18, 22),
        "build": (22, 26),
        "drop2": (26, 34),
        "outro": (34, 37),
    },
    "teaser": {
        "hook": (0, 2),
        "riser": (2, 4),
        "drop1": (4, 10),
        "drop2": (10, 12),
        "outro": (12, 15),
    },
}
STYLES = ("phonk", "darksynth")

OUT_DIR = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).resolve().parents[1])
CUT = sys.argv[2] if len(sys.argv) > 2 else "full"
STYLE = sys.argv[3] if len(sys.argv) > 3 else "phonk"
if CUT not in CUTS or STYLE not in STYLES:
    sys.exit(f"unknown cut/style: {CUT} {STYLE}")
SECTIONS = CUTS[CUT]
BARS = max(b for _, b in SECTIONS.values())
N = int((BARS * BAR + TAIL) * SR)

# i - VI - iv - V in D minor, one chord per bar.
CHORDS = [("D", 0, "m"), ("D", 0, "m"), ("Bb", -4, "M"), ("Bb", -4, "M"), ("G", -7, "m"), ("G", -7, "m"), ("A", -5, "M"), ("A", -5, "M")]


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def t_of(bar, step=0):
    return bar * BAR + step * STEP


def idx(seconds):
    return int(round(seconds * SR))


def sos(kind, freq, order=2):
    nyq = SR / 2
    if kind == "band":
        lo, hi = freq
        return butter(order, [max(lo, 20) / nyq, min(hi, nyq * 0.95) / nyq], btype="band", output="sos")
    return butter(order, min(freq, nyq * 0.95) / nyq, btype=kind, output="sos")


def filt(x, kind, freq, order=2):
    return sosfilt(sos(kind, freq, order), x)


def env(n, attack, decay, curve=1.0):
    t = np.arange(n) / SR
    a = np.minimum(1.0, t / attack) if attack > 0 else np.ones(n)
    return a * np.exp(-t / decay) ** curve


def place(buf, sig, at, gain=1.0):
    i = idx(at)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i] * gain


def saw(freq, n, phase=0.0):
    t = np.arange(n) / SR
    return 2 * ((freq * t + phase) % 1.0) - 1


def square(freq, n):
    t = np.arange(n) / SR
    return np.sign(np.sin(2 * np.pi * freq * t))


def sine_sweep(f0, f1, n, sweep):
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / sweep)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


# ---------- instruments ----------

def kick(level=1.0):
    n = idx(0.45)
    body = sine_sweep(190, 48, n, 0.035) * env(n, 0.001, 0.22)
    click = filt(rng.standard_normal(n), "high", 2500) * env(n, 0, 0.004)
    return np.tanh(2.2 * (body + 0.5 * click)) * level


def snare():
    n = idx(0.32)
    tone = np.sin(2 * np.pi * 185 * np.arange(n) / SR) * env(n, 0, 0.06)
    noise = filt(rng.standard_normal(n), "band", (1200, 9000)) * env(n, 0, 0.13)
    clap = np.zeros(n)
    for k, d in enumerate((0.0, 0.011, 0.022)):
        burst = filt(rng.standard_normal(idx(0.2)), "band", (900, 3500)) * env(idx(0.2), 0, 0.012 if k < 2 else 0.09)
        place(clap, burst, d)
    return np.tanh(1.6 * (0.7 * tone + 0.8 * noise + 0.9 * clap))


def hat(open_=False):
    n = idx(0.3 if open_ else 0.06)
    x = filt(rng.standard_normal(n), "high", 7500, 4)
    return x * env(n, 0, 0.12 if open_ else 0.018) * 0.55


def cowbell(midi, length=0.32):
    n = idx(length)
    f = hz(midi)
    x = 0.6 * square(f, n) + 0.4 * square(f * 1.483, n)
    x = filt(x, "band", (f * 0.9, 7000))
    e = 0.65 * env(n, 0.0005, 0.02) + 0.35 * env(n, 0.0005, 0.16)
    return x * e * 0.5


def bass808(midi, length, glide_from=None):
    n = idx(length)
    t = np.arange(n) / SR
    f_target = hz(midi)
    f_start = hz(glide_from) if glide_from is not None else f_target * 2
    glide = 0.06 if glide_from is not None else 0.025
    f = f_target + (f_start - f_target) * np.exp(-t / glide)
    x = np.sin(2 * np.pi * np.cumsum(f) / SR)
    e = env(n, 0.002, max(length * 0.9, 0.2))
    e[-idx(0.01):] *= np.linspace(1, 0, idx(0.01))
    x = np.tanh(3.5 * x * e)
    return filt(x, "low", 1800) * 0.75


def power_chord(root_midi, length, muted):
    n = idx(length)
    voices = []
    for semis in (0, 7, 12):
        for det in (-0.07, 0.0, 0.08):
            voices.append(saw(hz(root_midi + semis + det), n, rng.random()))
    x = np.sum(voices, axis=0) / len(voices)
    x = filt(x, "low", 1600 if muted else 3200)
    x = np.tanh(18 * x)
    x = filt(x, "band", (95, 4800), 2)
    e = env(n, 0.002, 0.07 if muted else 0.6)
    e[-idx(0.008):] *= np.linspace(1, 0, idx(0.008))
    return x * e * 0.5


def pad(midis, length):
    n = idx(length)
    x = np.zeros(n)
    for m in midis:
        for det in (-0.12, -0.04, 0.05, 0.13):
            x += saw(hz(m + det), n, rng.random())
    x = filt(x / (len(midis) * 4), "low", 1100)
    t = np.arange(n) / SR
    e = np.minimum(1, t / 0.6) * np.minimum(1, (length - t) / 0.4)
    return x * e * 0.6


def supersaw(midis, length, attack=0.003, decay=0.5, cutoff=3800, voices=(-0.18, -0.07, 0.0, 0.08, 0.19)):
    n = idx(length)
    x = np.zeros(n)
    for m in midis:
        for det in voices:
            x += saw(hz(m + det), n, rng.random())
    x = filt(x / (len(midis) * len(voices)), "low", cutoff)
    e = env(n, attack, decay)
    e[-idx(0.01):] *= np.linspace(1, 0, idx(0.01))
    return np.tanh(2.2 * x) * e * 0.55


def pluck(midi, length=0.22):
    n = idx(length)
    x = saw(hz(midi), n, rng.random()) + 0.6 * saw(hz(midi + 12.06), n, rng.random())
    bright = filt(x, "low", 5200) * env(n, 0.001, 0.03)
    body = filt(x, "low", 1300) * env(n, 0.001, 0.11)
    return (bright + body) * 0.32


def reese(midi, length):
    n = idx(length)
    x = saw(hz(midi - 0.14), n, rng.random()) + saw(hz(midi + 0.14), n, rng.random()) + 0.6 * np.sin(2 * np.pi * hz(midi) * np.arange(n) / SR)
    x = np.tanh(2.6 * filt(x, "low", 520, 4))
    t = np.arange(n) / SR
    e = np.minimum(1, t / 0.01) * np.minimum(1, (length - t) / 0.02)
    return x * e * 0.5


def noise_riser(length, f0=300, f1=9000):
    n = idx(length)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    block = 1024
    for i in range(0, n, block):
        frac = i / n
        f = f0 * (f1 / f0) ** frac
        out[i : i + block] = filt(x[i : i + block], "band", (f * 0.7, f * 1.4))
    e = (np.arange(n) / n) ** 2.2
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(200 * (7 ** (t / length))) / SR)
    return (0.8 * out + 0.15 * tone) * e


def impact():
    n = idx(2.2)
    boom = sine_sweep(80, 32, n, 0.25) * env(n, 0.001, 0.7)
    crash = filt(rng.standard_normal(n), "high", 2500) * env(n, 0.001, 0.55)
    return np.tanh(2.5 * boom) * 0.9 + crash * 0.35


def reverse_swell(length):
    n = idx(length)
    x = filt(rng.standard_normal(n), "high", 1800) * env(n, 0, length / 3.5)
    return x[::-1] * 0.5


def reverb(x, seconds=1.6, mix=0.25, seed=3):
    r = np.random.default_rng(seed)
    n = idx(seconds)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / SR / (seconds / 5))
    ir = filt(ir, "low", 6000)
    ir /= np.sqrt(np.sum(ir**2))
    wet = fftconvolve(x, ir)[: len(x)]
    return (1 - mix) * x + mix * wet


# ---------- arrangement ----------

def in_section(bar, *names):
    return any(s in SECTIONS and SECTIONS[s][0] <= bar < SECTIONS[s][1] for s in names)


def chord_at(bar):
    return CHORDS[bar % len(CHORDS)]


def chord_tones(bar):
    _, off, kind = chord_at(bar)
    third = 3 if kind == "m" else 4
    root = 74 + off
    return [root, root + third, root + 7, root + 12, root + 7, root + third, root + (10 if kind == "m" else 7)]


drums = np.zeros(N)
hats = np.zeros(N)
bass = np.zeros(N)
bells = np.zeros(N)
gtr_l = np.zeros(N)
gtr_r = np.zeros(N)
pads = np.zeros(N)
fx = np.zeros(N)

DARK = STYLE == "darksynth"
KICK_FULL = [0, 4, 8, 12] if DARK else [0, 3, 6, 8, 11, 14]
BELL_STEPS = [0, 3, 6, 8, 10, 12, 14]
CHUG = [0, 1, 2, 4, 5, 6, 8, 9, 10, 12, 13, 14]

for bar in range(BARS):
    name, off, _ = chord_at(bar)
    root_bass = 38 + off
    full = in_section(bar, "drop1", "drop2")
    intro = in_section(bar, "intro")

    if full or intro:
        for s in KICK_FULL if full else [0, 6, 8]:
            place(drums, kick(1.0 if full else 0.8), t_of(bar, s))
        for s in (4, 12):
            place(drums, snare(), t_of(bar, s), 0.9)
        steps = range(0, 16, 1 if full else 2)
        for s in steps:
            place(hats, hat(), t_of(bar, s), 0.6 if s % 4 else 0.9)
        if full and bar % 2 == 1:
            for k in range(6):
                place(hats, hat(), t_of(bar, 14) + k * STEP / 3, 0.7)
        if full and bar % 4 == 3:
            place(hats, hat(True), t_of(bar, 10), 0.8)
        tones = chord_tones(bar)
        if DARK:
            for s in range(0, 16, 2):
                place(bass, reese(root_bass + (12 if s % 4 == 2 else 0), STEP * 1.8), t_of(bar, s))
            arp = [tones[0], tones[2], tones[3], tones[2], tones[1], tones[2], tones[3], tones[4]]
            for s in range(0, 16, 1 if full else 2):
                place(bells, pluck(arp[s % len(arp)] + (12 if in_section(bar, "drop2") and s % 4 == 3 else 0)), t_of(bar, s), 0.85)
        else:
            place(bass, bass808(root_bass, BAR * 0.48), t_of(bar, 0))
            glide_from = root_bass + 12 if bar % 2 else None
            place(bass, bass808(root_bass, BAR * 0.45, glide_from), t_of(bar, 8))
            for k, s in enumerate(BELL_STEPS):
                place(bells, cowbell(tones[k] + (12 if in_section(bar, "drop2") and k % 2 else 0)), t_of(bar, s), 0.9)
        if full and DARK:
            stab = [tones[0] - 12, tones[1] - 12, tones[2] - 12, tones[0]]
            for s in (2, 6, 10, 14):
                place(gtr_l, supersaw(stab, STEP * 1.6, decay=0.12), t_of(bar, s), 1.0)
                place(gtr_r, supersaw([m + 0.05 for m in stab], STEP * 1.6, decay=0.12), t_of(bar, s) + 0.008, 1.0)
            place(pads, pad([tones[0] - 12, tones[1] - 12, tones[2] - 12], BAR), t_of(bar, 0), 0.5)
        elif full:
            gtr_root = 38 + off if 38 + off >= 36 else 50 + off
            for s in CHUG:
                accent = s in (0, 8)
                place(gtr_l, power_chord(gtr_root, STEP * (3.6 if accent else 0.95), not accent), t_of(bar, s), 1.0)
                place(gtr_r, power_chord(gtr_root + 0.04, STEP * (3.6 if accent else 0.95), not accent), t_of(bar, s) + 0.006, 1.0)

    if in_section(bar, "breakdown"):
        place(drums, kick(), t_of(bar, 0))
        place(drums, snare(), t_of(bar, 8), 1.0)
        for s in range(0, 16, 4):
            place(hats, hat(), t_of(bar, s + 2), 0.5)
        tones = chord_tones(bar)
        place(pads, pad([tones[0] - 12, tones[1] - 12, tones[2] - 12], BAR + 0.3), t_of(bar, 0))
        place(bass, (reese(root_bass, BAR * 0.95) if DARK else bass808(root_bass, BAR * 0.95)), t_of(bar, 0))
        for k, s in enumerate((0, 6, 10)):
            place(bells, pluck(tones[k], 0.5) if DARK else cowbell(tones[k]), t_of(bar, s), 0.7)

    if in_section(bar, "build"):
        k_steps = [0, 4, 8, 12] if bar < 24 else list(range(0, 16, 2))
        for s in k_steps:
            place(drums, kick(0.9), t_of(bar, s))
        rate = 4 if bar == 22 else 2 if bar == 23 else 1
        for s in range(0, 16, rate):
            place(drums, snare(), t_of(bar, s), 0.25 + 0.55 * (bar - 22 + s / 16) / 4)
        place(bass, (reese(root_bass, BAR * 0.9) if DARK else bass808(root_bass, BAR * 0.9)), t_of(bar, 0))
        tones = chord_tones(bar)
        place(pads, pad([tones[0] - 12, tones[2] - 12], BAR), t_of(bar, 0), 0.6)

    if in_section(bar, "riser"):
        first = bar == SECTIONS["riser"][0]
        rate = 4 if first else 1
        for s in range(0, 16 if first else 12, rate):
            place(drums, snare(), t_of(bar, s), 0.3 + 0.5 * s / 16)
        for s in range(0, 12, 4):
            place(drums, kick(0.8), t_of(bar, s))

def big_chord(root, length, at, gain):
    if DARK:
        notes = [root, root + 7, root + 12, root + 15]
        place(gtr_l, supersaw(notes, length, decay=length * 0.6, cutoff=5200), at, gain * 1.3)
        place(gtr_r, supersaw([m + 0.05 for m in notes], length, decay=length * 0.6, cutoff=5200), at + 0.008, gain * 1.3)
    else:
        place(gtr_l, power_chord(root, length, False), at, gain)
        place(gtr_r, power_chord(root + 0.04, length, False), at + 0.006, gain)


def bell(midi, length):
    return pluck(midi, length) if DARK else cowbell(midi, length)


# hook: swell into one hit on bar 1, then tension
place(fx, reverse_swell(BAR * 1.0), t_of(0, 0), 0.9)
place(fx, impact(), t_of(1, 0), 1.0)
place(drums, kick(1.2), t_of(1, 0))
big_chord(38, BAR, t_of(1, 0), 1.2)
for s in (8, 12, 14):
    place(hats, hat(), t_of(1, s), 0.5)

# risers and drops
place(fx, noise_riser(2 * BAR - BEAT), t_of(SECTIONS["riser"][0], 0), 0.8)
if "build" in SECTIONS:
    a, b = SECTIONS["build"]
    place(fx, noise_riser((b - a) * BAR - BEAT), t_of(a, 0), 0.7)
for name in ("drop1", "drop2"):
    a, b = SECTIONS[name]
    place(fx, impact(), t_of(a, 0), 0.9)
    place(fx, reverse_swell(BEAT * 2), t_of(a, 0) - BEAT * 2, 0.6)
    if b - a >= 8:
        place(fx, impact(), t_of(a + 4, 0), 0.35)
if "breakdown" in SECTIONS:
    place(fx, impact(), t_of(SECTIONS["breakdown"][0], 0), 0.35)

# outro: final hit and ringing chord
o = SECTIONS["outro"][0]
place(fx, impact(), t_of(o, 0), 1.1)
place(drums, kick(1.2), t_of(o, 0))
big_chord(38, BAR * 2.5, t_of(o, 0), 1.1)
place(pads, pad([62, 65, 69, 74], BAR * (BARS - o - 0.5)), t_of(o, 0), 1.0)
for k, (m, ln, g) in enumerate(((86, 1.2, 0.8), (81, 1.0, 0.5), (74, 1.0, 0.35))):
    if o + k < BARS:
        place(bells, bell(m, ln), t_of(o + k, 0), g)


def lowpass_sections(x, cutoff, *names):
    for s in names:
        a, b = SECTIONS[s]
        i, j = idx(t_of(a)), idx(t_of(b))
        x[i:j] = filt(x[i:j], "low", cutoff, 4)
    return x


# kick ducks the bass and guitars
duck = np.ones(N)
for bar in range(BARS):
    if in_section(bar, "drop1", "drop2", "intro"):
        for s in KICK_FULL:
            i = idx(t_of(bar, s))
            n = idx(0.12)
            j = min(N, i + n)
            duck[i:j] = np.minimum(duck[i:j], 0.35 + 0.65 * np.linspace(0, 1, j - i) ** 1.5)

bass *= duck
gtr_l *= duck
gtr_r *= duck

music_c = 1.0 * drums + 0.5 * hats + 0.8 * bass
bells_rev = reverb(bells, 1.4, 0.3, 11)
pads_rev = reverb(pads, 2.4, 0.45, 5)
fx_rev = reverb(fx, 2.0, 0.3, 9)

left = music_c + 0.55 * bells_rev + 0.42 * gtr_l + 0.1 * gtr_r + 0.5 * pads_rev + 0.8 * fx_rev
right = music_c + 0.55 * reverb(bells, 1.4, 0.3, 12) + 0.42 * gtr_r + 0.1 * gtr_l + 0.5 * reverb(pads, 2.4, 0.45, 6) + 0.8 * reverb(fx, 2.0, 0.3, 10)

if "intro" in SECTIONS:
    for ch in (left, right):
        lowpass_sections(ch, 650, "intro")

# riser opens the filter
for ch in (left, right):
    a, b = SECTIONS["riser"]
    i, j = idx(t_of(a)), idx(t_of(b))
    seg = ch[i:j].copy()
    out = np.zeros_like(seg)
    block = 2048
    for k in range(0, len(seg), block):
        f = 650 * (16000 / 650) ** (k / len(seg))
        out[k : k + block] = filt(seg[k : k + block], "low", f, 2)
    ch[i:j] = out
    gap_i = idx(t_of(b) - BEAT * 0.5)
    ch[gap_i:j] *= np.linspace(1, 0, j - gap_i) ** 3
    if "build" in SECTIONS:
        b2 = SECTIONS["build"][1]
        gi, gj = idx(t_of(b2) - BEAT), idx(t_of(b2))
        ch[gi:gj] *= np.linspace(1, 0.05, gj - gi)

stereo = np.stack([left, right], axis=1)
stereo = filt(stereo.T, "high", 28, 2).T
peak = np.max(np.abs(stereo))
stereo = np.tanh(1.6 * stereo / peak) / np.tanh(1.6)
fade = idx(TAIL + BAR * 0.5)
stereo[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
stereo *= 0.93

out_dir = OUT_DIR
pcm = (np.clip(stereo, -1, 1) * 32767).astype("<i2")
wav = out_dir / "public" / f"music-raw-{CUT}-{STYLE}.wav"
wav.parent.mkdir(parents=True, exist_ok=True)
import wave

with wave.open(str(wav), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())

timing = {"bpm": BPM, "bars": BARS, "seconds": BARS * BAR, "sections": {k: {"from": v[0], "to": v[1]} for k, v in SECTIONS.items()}}
(out_dir / "src").mkdir(exist_ok=True)
(out_dir / "src" / f"timing-{CUT}.json").write_text(json.dumps(timing, indent=2))
print(wav)
