#!/bin/sh
set -e
cd "$(dirname "$0")/.."
for cut in full teaser; do
  for style in phonk darksynth; do
    python3 -I music/make_track.py . "$cut" "$style" &
  done
done
wait
for cut in full teaser; do
  for style in phonk darksynth; do
    ffmpeg -hide_banner -loglevel error -y -i "public/music-raw-$cut-$style.wav" -af loudnorm=I=-11:TP=-1:LRA=9 -ar 44100 "public/music-$cut-$style.wav"
  done
done
