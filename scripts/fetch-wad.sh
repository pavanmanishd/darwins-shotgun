#!/usr/bin/env bash
set -euo pipefail

DEB_URL="http://deb.debian.org/debian/pool/non-free/d/doom-wad-shareware/doom-wad-shareware_1.9.fixed-4_all.deb"
SHA256="1d7d43be501e67d927e415e0b8f3e29c3bf33075e859721816f652a526cac771"
DEST="$(cd "$(dirname "$0")/.." && pwd)/engine/doom1.wad"

sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi; }
verify() { [ "$(sha256 "$1" | cut -d' ' -f1)" = "$SHA256" ]; }

if [ -f "$DEST" ] && verify "$DEST"; then
  echo "doom1.wad already present"
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/pkg.deb" "$DEB_URL"
(cd "$tmp" && ar x pkg.deb && tar -xf data.tar.xz ./usr/share/games/doom/doom1.wad)
verify "$tmp/usr/share/games/doom/doom1.wad" || { echo "checksum mismatch" >&2; exit 1; }
mv "$tmp/usr/share/games/doom/doom1.wad" "$DEST"
echo "doom1.wad -> $DEST"
