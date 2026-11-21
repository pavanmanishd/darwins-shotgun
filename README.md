# Darwin's Shotgun

DOOM's monsters, rewritten by an LLM while you fight them.

Every imp runs a JavaScript brain. When a species dies out, Kimi K3.1 Pro on Cerebras breeds a replacement from the two fittest species and a profile of how you play. The new code streams onto the screen and the child teleports in seconds later, while the game keeps running at full frame rate. Generation 0 walks into your shotgun. A few dozen generations later they wait off-screen and hit you from the side.

Built on the open-source DOOM engine via [doomgeneric](https://github.com/ozkl/doomgeneric), compiled to WebAssembly.

## How it works

- **Brains decide, the engine acts.** Each time an imp would run its chase logic, the engine passes a sensor snapshot (distance, whether it's in your crosshair, whether it can shoot, when you last fired, nearby allies) to that species' `think(s, mem, squad)` function. It returns a move (advance, retreat, strafe, flank, hold) and whether to attack. Movement speed and damage stay vanilla, and an imp can attack at most once per second. They get smarter, not stronger.
- **Untrusted code runs sandboxed.** Each species runs in its own QuickJS VM with a 1 MB memory cap and a 1 ms deadline per call. New code must pass 300 randomized calls before it's installed. Broken children get one repair attempt; after that they're stillborn.
- **Fitness rewards what reads well on camera.** Damage to you counts, damage from outside your view counts double, kills count 25, and survival time counts up to 60 seconds so hiding doesn't pay.
- **Steady-state evolution.** Four species of three imps are alive at once. Four children are always bred ahead, so even when your death clears every species at once, the replacements are already waiting. The best retired species stay in a hall of fame and keep breeding.

## Run it locally

Requirements: Emscripten (`brew install emscripten`), Node 22+, pnpm.

```sh
scripts/build.sh                 # fetches the shareware WAD, builds the engine and the web app
cp web/.env.example web/.env     # add CEREBRAS_API_KEY and CEREBRAS_MODEL
cd web && pnpm dev
```

Open the printed URL. Live evolution is on in dev. Add `?champions` to play against the saved gene pool without API calls.

Controls: WASD move, arrow keys turn, Ctrl fire, Space use.

## Deploy

The Worker in `proxy/` serves the built site and `/api/breed`. It holds the API key, fixes the model and system prompt server-side, caps prompt and output size, and rate-limits per IP.

```sh
scripts/build.sh
cd proxy && pnpm install
pnpm exec wrangler secret put CEREBRAS_API_KEY
pnpm exec wrangler deploy --var CEREBRAS_MODEL:<model id>
```

The public site opens in champions mode (`web/public/champions.json`, exported from a play session with "Export gene pool"). Add `?live` for live evolution.

## Credits and licenses

- Engine: [doomgeneric](https://github.com/ozkl/doomgeneric), based on Chocolate Doom and id Software's 1997 source release. GPL-2.0.
- Game data: the DOOM shareware WAD (episode 1) by id Software. Not included in this repository; `scripts/fetch-wad.sh` downloads the unmodified v1.9 file and verifies its checksum.
- Everything in this repository is GPL-2.0. See `LICENSE`.

DOOM is a trademark of id Software. This project is not affiliated with or endorsed by id Software, Bethesda or Microsoft.
