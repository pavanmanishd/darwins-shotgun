# Darwin's Shotgun

Real DOOM in the browser, where Kimi K3.1 Pro on Cerebras evolves the imps' brains.

**Play:** https://darwins-shotgun.pavanmanishd.workers.dev

Every imp runs a small JavaScript function that decides how it moves and when it attacks. Kimi breeds new functions from the fittest species and from how the player fights, through [OpenClaw](https://github.com/openclaw/openclaw). On the site you fight either the hand-written Gen 0 or the evolved champions, and see how long you last.

Built for the Kimi K3.1 Pro × Cerebras × OpenClaw hackathon. #KimiOnCerebras

## How it works

1. **Engine.** [doomgeneric](https://github.com/ozkl/doomgeneric) compiled to WebAssembly, running shareware episode 1.
2. **Brains.** About 12 times a second, each imp's species gets a sensor snapshot: distance, whether it's in your crosshair, when you last fired, nearby allies. Its `think(s, mem, squad)` returns a move and whether to attack. Speed and damage stay vanilla.
3. **Sandbox.** Each species runs in its own QuickJS VM with a memory cap and a per-call deadline. New code must pass randomized test calls before it enters the level.
4. **Fitness.** Damage to the player, double for hits from outside their view, plus kills and survival time. Scores from only a few imps are pulled toward the average, and champions are re-tested.
5. **Breeding.** Two parents' code and stats plus a profile of the player go to an OpenClaw gateway, which runs Kimi K3.1 Pro on Cerebras and returns the child.

## Run locally

Requirements: Emscripten, Node 22+, pnpm, OpenClaw.

```sh
scripts/build.sh                                   # fetch the shareware WAD, build engine and web app

mkdir -p ~/.openclaw-darwin
cp openclaw/openclaw.example.json ~/.openclaw-darwin/openclaw.json
export CEREBRAS_API_KEY=... OPENCLAW_GATEWAY_TOKEN=...
openclaw --profile darwin gateway                  # Kimi K3.1 Pro on Cerebras, chat completions on :18810

cp web/.env.example web/.env                       # CEREBRAS_API_KEY = the gateway token
cd web && pnpm dev                                 # live evolution
```

URL options: `?vs=gen0` or `?vs=evolved` (challenge mode, no API calls), `?thoughts` (show each imp's decision), `?autopilot` (a bot plays).

Controls: WASD move, arrows turn, Ctrl fire, Space use.

## Repository

| Path | What |
| --- | --- |
| `engine/` | doomgeneric with the brain bridge (C → JS hooks for sensors, decisions, events) |
| `web/` | Game, sandbox, evolution director, breeding client, challenge mode |
| `openclaw/` | OpenClaw gateway config used for breeding |
| `sim/` | Headless runs: evolution (`run.mjs`), benchmarks (`bench.mjs`), clip capture, pool export |
| `video/` | Remotion trailer and the generator for its original music |
| `site/` | Static deploy of the public site (Cloudflare) |

```sh
cd sim && MINUTES=40 node run.mjs kimi-openclaw    # real evolution through the gateway
node export-pool.mjs results/kimi-openclaw.json ../web/public/pools/evolved.json
cd ../site && pnpm deploy                          # after scripts/build.sh
```

## License

GPL-2.0, see `LICENSE`. Engine based on Chocolate Doom and id Software's 1997 source release. The shareware WAD isn't included; `scripts/fetch-wad.sh` downloads the unmodified v1.9 file and checks its hash.

DOOM is a trademark of id Software. This project is not affiliated with id Software, Bethesda or Microsoft.
