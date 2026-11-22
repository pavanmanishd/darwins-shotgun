"""Cuts a Speed Bounty entry video (60 s max) from a raw run recording and a link-check recording.

Usage: python3 -I edit.py <config.json> <out.mp4>
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
W, H, FPS = 1920, 1200, 30

cfg = json.loads(Path(sys.argv[1]).read_text())
out = sys.argv[2]
tmp = Path(tempfile.mkdtemp())


def text_file(name, text):
    p = tmp / f"{name}.txt"
    p.write_text(text)
    return str(p)


def caption(name, text, y, size=44, box="0x000000@0.75"):
    return (
        f"drawtext=fontfile='{FONT}':textfile='{text_file(name, text)}':fontsize={size}:fontcolor=white:"
        f"x=(w-text_w)/2:y={y}:box=1:boxcolor={box}:boxborderw=18"
    )


def blur_avatar(src):
    a = cfg["avatar"]
    return (
        f"[{src}]split[{src}b][{src}a];[{src}a]crop={a['w']}:{a['h']}:{a['x']}:{a['y']},scale=8:8,scale={a['w']}:{a['h']}:flags=neighbor[{src}p];"
        f"[{src}b][{src}p]overlay={a['x']}:{a['y']}"
    )


run, links = cfg["run"], cfg["links"]
ans, end = cfg["answer_at"], cfg["run_end"]
tps, p90 = cfg["tps_mean"], cfg["tps_p90"]
SPEEDUP = cfg.get("speedup", 12)
scale = f"scale={W}:{H}:force_original_aspect_ratio=decrease:flags=lanczos,pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color=0x0d0e12,fps={FPS},setsar=1"

parts = []
filters = []

filters.append(
    f"color=c=0x0d0e12:s={W}x{H}:d=2.5:r={FPS},"
    + caption("t1", "Santa's Speedy Shopper", 430, 96, "0x000000@0")
    + ","
    + caption("t2", "OpenClaw  +  Kimi K3.1 Pro on Cerebras", 580, 52, "0x000000@0")
    + ","
    + caption("t3", "5 Christmas gifts from real shopping sites", 670, 40, "0x000000@0")
    + ",format=yuv420p[p0]"
)
parts.append("p0")

filters.append(f"[0:v]trim={cfg['start']}:{cfg['wait_from']},setpts=PTS-STARTPTS[a0]")
filters.append(blur_avatar("a0") + f",{scale}," + caption("ca", "One prompt, sent to the speed-patched OpenClaw", 1080) + ",format=yuv420p[p1]")
parts.append("p1")

filters.append(f"[0:v]trim={cfg['wait_from']}:{ans},setpts=(PTS-STARTPTS)/{SPEEDUP}[b0]")
filters.append(
    blur_avatar("b0") + f",{scale},"
    + caption("cb", f"{SPEEDUP}x fast-forward: waiting in the Cerebras queue (queue time is not part of TPS)", 1080, 38)
    + ",format=yuv420p[p2]"
)
parts.append("p2")

r = cfg["readout"]
zoom_at = end - ans - 5
filters.append(f"[0:v]trim={ans}:{end},setpts=PTS-STARTPTS,split[c0][cz]")
filters.append(f"[cz]crop={r['w']}:{r['h']}:{r['x']}:{r['y']},scale=1500:-2:flags=lanczos[zoom]")
filters.append(
    f"[c0]{scale}[cs];[cs][zoom]overlay=(W-w)/2:H-h-170:enable='gte(t,{zoom_at})',"
    + caption("cc", f"Server-measured decode speed: {tps} tok/s mean, {p90} p90", 60, 46)
    + ",format=yuv420p[p3]"
)
parts.append("p3")

if "answer" in cfg:
    a = cfg["answer"]
    filters.append(
        f"[2:v]trim={a['from']}:{a['from'] + a['len']},setpts=PTS-STARTPTS,"
        f"scale=-2:{H}:flags=lanczos,pad={W}:{H}:(ow-iw)/2:0:color=0x0d0e12,fps={FPS},setsar=1,"
        + caption("an", "All 5 gifts with their product links", 40, 44)
        + ",format=yuv420p[p4]"
    )
    parts.append("p4")

for i, seg in enumerate(cfg["pages"]):
    filters.append(
        f"[1:v]trim={seg['from']}:{seg['from'] + seg['len']},setpts=PTS-STARTPTS,{scale},"
        + caption(f"pg{i}", f"Real product page {i + 1}/{len(cfg['pages'])}: {seg['label']}", 1080, 42)
        + f",format=yuv420p[q{i}]"
    )
    parts.append(f"q{i}")

filters.append(
    f"color=c=0x0d0e12:s={W}x{H}:d=4:r={FPS},"
    + caption("e1", f"{tps} TPS", 420, 150, "0x000000@0")
    + ","
    + caption("e2", "mean of per-call server decode rates, official speed patch", 640, 40, "0x000000@0")
    + ","
    + caption("e3", "5 real products, links shown above", 720, 40, "0x000000@0")
    + ",format=yuv420p[p9]"
)
parts.append("p9")

filters.append("".join(f"[{p}]" for p in parts) + f"concat=n={len(parts)}:v=1:a=0[v]")

inputs = ["-i", run, "-i", links] + (["-i", cfg["answer"]["file"]] if "answer" in cfg else [])
cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs,
       "-filter_complex", ";".join(filters), "-map", "[v]", "-c:v", "h264_videotoolbox", "-b:v", "12M",
       "-pix_fmt", "yuv420p", "-movflags", "+faststart", out]
subprocess.run(cmd, check=True)
dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True).stdout.strip()
print(out, dur, "s")
