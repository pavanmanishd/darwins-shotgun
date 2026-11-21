#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"

"$root/scripts/fetch-wad.sh"
make -C "$root/engine" -f Makefile.web -j8
(cd "$root/web" && pnpm install --frozen-lockfile && pnpm build)
